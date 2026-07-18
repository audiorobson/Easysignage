import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Issuer, generators, type Client } from 'openid-client';
import { mergeRolePermissions } from '../common/permissions';
import { PrismaService } from '../prisma/prisma.service';

interface PendingSsoState {
  tenantId: string;
  nonce: string;
  createdAt: number;
}

interface CachedIssuer {
  issuer: Issuer;
  expiresAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;
const ISSUER_CACHE_TTL_MS = 10 * 60 * 1000;

export interface SsoSession {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: { id: string; name: string; email: string };
  tenant: { id: string; name: string; slug: string };
}

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);
  private readonly pendingStates = new Map<string, PendingSsoState>();
  private readonly issuerCache = new Map<string, CachedIssuer>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  private get apiPublicUrl(): string {
    return (this.config.get<string>('API_URL') ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');
  }

  get cmsOrigin(): string {
    return (this.config.get<string>('CMS_ORIGIN') ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  get redirectUri(): string {
    return `${this.apiPublicUrl}/auth/sso/callback`;
  }

  private async getIssuer(tenantId: string, issuerUrl: string): Promise<Issuer> {
    const cached = this.issuerCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.issuer;
    }
    const issuer = await Issuer.discover(issuerUrl);
    this.issuerCache.set(tenantId, { issuer, expiresAt: Date.now() + ISSUER_CACHE_TTL_MS });
    return issuer;
  }

  private buildClient(issuer: Issuer, clientId: string, clientSecret: string): Client {
    return new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [this.redirectUri],
      response_types: ['code'],
    });
  }

  /** Invalida o cache de discovery — chamar após alterar a configuração de SSO do tenant. */
  invalidateIssuerCache(tenantId: string): void {
    this.issuerCache.delete(tenantId);
  }

  async buildAuthorizationUrl(tenantSlug: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant || tenant.status !== 'active') {
      throw new UnauthorizedException('Tenant inválido');
    }
    if (!tenant.ssoEnabled || !tenant.ssoIssuerUrl || !tenant.ssoClientId || !tenant.ssoClientSecret) {
      throw new BadRequestException('SSO não está configurado para esta organização.');
    }

    const issuer = await this.getIssuer(tenant.id, tenant.ssoIssuerUrl);
    const client = this.buildClient(issuer, tenant.ssoClientId, tenant.ssoClientSecret);

    const state = generators.state();
    const nonce = generators.nonce();
    this.pruneExpiredStates();
    this.pendingStates.set(state, { tenantId: tenant.id, nonce, createdAt: Date.now() });

    return client.authorizationUrl({
      scope: 'openid email profile',
      state,
      nonce,
    });
  }

  async handleCallback(query: Record<string, unknown>): Promise<SsoSession> {
    const state = typeof query.state === 'string' ? query.state : undefined;
    if (!state) {
      throw new UnauthorizedException('Resposta do provedor de identidade sem state.');
    }

    const pending = this.pendingStates.get(state);
    if (!pending) {
      throw new UnauthorizedException('Sessão de SSO inválida ou já utilizada.');
    }
    this.pendingStates.delete(state);

    if (Date.now() - pending.createdAt > STATE_TTL_MS) {
      throw new UnauthorizedException('Sessão de SSO expirada — tente novamente.');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: pending.tenantId } });
    if (
      !tenant ||
      tenant.status !== 'active' ||
      !tenant.ssoEnabled ||
      !tenant.ssoIssuerUrl ||
      !tenant.ssoClientId ||
      !tenant.ssoClientSecret
    ) {
      throw new UnauthorizedException('SSO indisponível para esta organização.');
    }

    const issuer = await this.getIssuer(tenant.id, tenant.ssoIssuerUrl);
    const client = this.buildClient(issuer, tenant.ssoClientId, tenant.ssoClientSecret);

    const callbackUrl = this.buildCallbackUrl(query);
    const params = client.callbackParams(callbackUrl);
    const tokenSet = await client.callback(this.redirectUri, params, {
      state,
      nonce: pending.nonce,
    });
    const claims = tokenSet.claims();

    const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : null;
    if (!email) {
      throw new UnauthorizedException('O provedor de identidade não devolveu um e-mail.');
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user || user.status !== 'active') {
      this.logger.warn(`Login SSO negado: ${email} não existe no tenant ${tenant.slug}`);
      throw new UnauthorizedException(
        `Utilizador ${email} não encontrado nesta organização. Peça a um administrador para o criar antes de usar o login único.`
      );
    }

    const permissions = mergeRolePermissions(user.userRoles.map((ur) => ur.role));
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      tenantId: tenant.id,
      email: user.email,
      permissions,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 604800,
      user: { id: user.id, name: user.name, email: user.email },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    };
  }

  buildCmsRedirectUrl(session: SsoSession): string {
    const payload = encodeURIComponent(
      JSON.stringify({ accessToken: session.accessToken, tenant: session.tenant.slug })
    );
    return `${this.cmsOrigin}/login/sso-callback#session=${payload}`;
  }

  buildCmsErrorRedirectUrl(message: string): string {
    return `${this.cmsOrigin}/login/sso-callback#error=${encodeURIComponent(message)}`;
  }

  private buildCallbackUrl(query: Record<string, unknown>): string {
    const url = new URL(this.redirectUri);
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string') {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private pruneExpiredStates(): void {
    const now = Date.now();
    for (const [key, value] of this.pendingStates) {
      if (now - value.createdAt > STATE_TTL_MS) {
        this.pendingStates.delete(key);
      }
    }
  }
}
