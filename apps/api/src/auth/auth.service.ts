import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { mergeRolePermissions } from '../common/permissions';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildTotpQrDataUrl,
  buildTotpUri,
  formatSecretForManualEntry,
  generateTotpSecret,
  verifyTotpCode,
} from './totp';

const TWO_FACTOR_CHALLENGE_PURPOSE = '2fa-challenge';
const TWO_FACTOR_CHALLENGE_TTL = '5m';

type SessionTenant = { id: string; name: string; slug: string };
type SessionUser = { id: string; name: string; email: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async login(tenantSlug: string, email: string, password: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant || tenant.status !== 'active') {
      throw new UnauthorizedException('Tenant inválido');
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: email.toLowerCase() } },
      include: {
        userRoles: { include: { role: true } },
      },
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.totpEnabled) {
      const challengeToken = await this.jwt.signAsync(
        { sub: user.id, tenantId: tenant.id, purpose: TWO_FACTOR_CHALLENGE_PURPOSE },
        { expiresIn: TWO_FACTOR_CHALLENGE_TTL }
      );
      return {
        requires2fa: true as const,
        challengeToken,
      };
    }

    const permissions = mergeRolePermissions(user.userRoles.map((ur) => ur.role));
    return this.issueSession(tenant, user, permissions);
  }

  async completeTwoFactorLogin(challengeToken: string, code: string) {
    let payload: { sub?: string; tenantId?: string; purpose?: string };
    try {
      payload = await this.jwt.verifyAsync(challengeToken);
    } catch {
      throw new UnauthorizedException('Challenge de 2FA inválido ou expirado');
    }
    if (payload.purpose !== TWO_FACTOR_CHALLENGE_PURPOSE || !payload.sub || !payload.tenantId) {
      throw new UnauthorizedException('Challenge de 2FA inválido');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        tenant: true,
        userRoles: { include: { role: true } },
      },
    });
    if (
      !user ||
      user.status !== 'active' ||
      user.tenantId !== payload.tenantId ||
      !user.totpEnabled ||
      !user.totpSecret
    ) {
      throw new UnauthorizedException('2FA indisponível para este utilizador');
    }
    if (!user.tenant || user.tenant.status !== 'active') {
      throw new UnauthorizedException('Tenant inválido');
    }

    if (!verifyTotpCode(user.totpSecret, code)) {
      throw new UnauthorizedException('Código de verificação inválido');
    }

    const permissions = mergeRolePermissions(user.userRoles.map((ur) => ur.role));
    return this.issueSession(user.tenant, user, permissions);
  }

  async getTotpStatus(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return { totpEnabled: user.totpEnabled };
  }

  async setupTwoFactor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }

    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret, totpEnabled: false },
    });

    const otpauthUrl = buildTotpUri(user.email, secret);
    const qrDataUrl = await buildTotpQrDataUrl(user.email, secret);

    return {
      secret: formatSecretForManualEntry(secret),
      otpauthUrl,
      qrDataUrl,
    };
  }

  async confirmTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      throw new BadRequestException(
        'Nenhuma configuração de 2FA pendente. Inicie o processo de ativação novamente.'
      );
    }

    if (!verifyTotpCode(user.totpSecret, code)) {
      throw new UnauthorizedException('Código de verificação inválido');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    return { totpEnabled: true };
  }

  async disableTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('A verificação em duas etapas não está ativada.');
    }

    if (!verifyTotpCode(user.totpSecret, code)) {
      throw new UnauthorizedException('Código de verificação inválido');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null },
    });
    return { totpEnabled: false };
  }

  private async issueSession(
    tenant: SessionTenant,
    user: SessionUser,
    permissions: string[]
  ) {
    const token = await this.jwt.signAsync({
      sub: user.id,
      tenantId: tenant.id,
      email: user.email,
      permissions,
    });

    return {
      accessToken: token,
      tokenType: 'Bearer' as const,
      expiresIn: 604800,
      user: { id: user.id, name: user.name, email: user.email },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    };
  }
}
