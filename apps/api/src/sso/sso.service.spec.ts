import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SsoService } from './sso.service';
import { FakeOidcProvider } from './testing/fake-oidc-provider';

const TENANT = {
  id: 'tenant-1',
  name: 'Acme',
  slug: 'acme',
  status: 'active',
  ssoEnabled: true,
};

function buildConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    API_URL: 'http://localhost:3001/api/v1',
    CMS_ORIGIN: 'http://localhost:3000',
    ...overrides,
  };
  return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
}

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    tenantId: TENANT.id,
    name: 'Ana',
    email: 'ana@acme.com',
    status: 'active',
    userRoles: [{ role: { permissionsJson: { all: true } } }],
    ...overrides,
  };
}

describe('SsoService (integração com IdP OIDC mock)', () => {
  let idp: FakeOidcProvider;
  let issuerUrl: string;

  beforeAll(async () => {
    idp = new FakeOidcProvider();
    issuerUrl = await idp.start();
  });

  afterAll(async () => {
    await idp.stop();
  });

  function buildService(
    tenantOverrides: Record<string, unknown> = {},
    user: ReturnType<typeof buildUser> | null = buildUser()
  ) {
    const tenant = {
      ...TENANT,
      ssoIssuerUrl: issuerUrl,
      ssoClientId: idp.clientId,
      ssoClientSecret: idp.clientSecret,
      ...tenantOverrides,
    };
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(tenant),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
      },
    };
    const jwt = new JwtService({ secret: 'test-jwt-secret' });
    const service = new SsoService(prisma as any, jwt, buildConfig());
    return { service, prisma, jwt, tenant };
  }

  it('completa o Authorization Code Flow ponta-a-ponta e emite uma sessão válida', async () => {
    const { service, jwt } = buildService();

    const authUrl = new URL(await service.buildAuthorizationUrl('acme'));
    expect(authUrl.origin).toBe(issuerUrl);
    const state = authUrl.searchParams.get('state')!;
    const nonce = authUrl.searchParams.get('nonce')!;
    expect(state).toBeTruthy();
    expect(nonce).toBeTruthy();

    const code = idp.mintAuthorizationCode({ sub: 'idp-sub-1', email: 'ANA@acme.com', nonce });

    const session = await service.handleCallback({ code, state });

    expect(session.tenant).toEqual({ id: 'tenant-1', name: 'Acme', slug: 'acme' });
    expect(session.user).toEqual({ id: 'user-1', name: 'Ana', email: 'ana@acme.com' });

    const decoded = await jwt.verifyAsync(session.accessToken);
    expect(decoded).toMatchObject({
      sub: 'user-1',
      tenantId: 'tenant-1',
      email: 'ana@acme.com',
      permissions: ['*'],
    });
  });

  it('rejeita o callback quando o state é desconhecido (não veio de buildAuthorizationUrl)', async () => {
    const { service } = buildService();
    await expect(service.handleCallback({ code: 'whatever', state: 'state-inexistente' })).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('rejeita reutilizar o mesmo state duas vezes (single-use)', async () => {
    const { service } = buildService();
    const authUrl = new URL(await service.buildAuthorizationUrl('acme'));
    const state = authUrl.searchParams.get('state')!;
    const nonce = authUrl.searchParams.get('nonce')!;
    const code = idp.mintAuthorizationCode({ sub: 'idp-sub-2', email: 'ana@acme.com', nonce });

    await service.handleCallback({ code, state });

    await expect(service.handleCallback({ code, state })).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita quando o id_token tem um nonce diferente do esperado', async () => {
    const { service } = buildService();
    const authUrl = new URL(await service.buildAuthorizationUrl('acme'));
    const state = authUrl.searchParams.get('state')!;
    const code = idp.mintAuthorizationCode({ sub: 'idp-sub-3', email: 'ana@acme.com', nonce: 'nonce-errado' });

    await expect(service.handleCallback({ code, state })).rejects.toThrow();
  });

  it('rejeita o login quando não existe utilizador ativo com esse e-mail no tenant', async () => {
    const { service } = buildService({}, null);
    const authUrl = new URL(await service.buildAuthorizationUrl('acme'));
    const state = authUrl.searchParams.get('state')!;
    const nonce = authUrl.searchParams.get('nonce')!;
    const code = idp.mintAuthorizationCode({ sub: 'idp-sub-4', email: 'desconhecido@acme.com', nonce });

    await expect(service.handleCallback({ code, state })).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita iniciar o fluxo quando o tenant não tem SSO configurado', async () => {
    const { service } = buildService({ ssoEnabled: false, ssoIssuerUrl: null, ssoClientId: null, ssoClientSecret: null });
    await expect(service.buildAuthorizationUrl('acme')).rejects.toThrow(BadRequestException);
  });

  it('gera URLs de redirecionamento de sucesso e erro para o CMS com o fragmento correto', () => {
    const { service } = buildService();
    const okUrl = service.buildCmsRedirectUrl({
      accessToken: 'abc',
      tokenType: 'Bearer',
      expiresIn: 1,
      user: { id: '1', name: 'A', email: 'a@b.com' },
      tenant: { id: 't', name: 'T', slug: 't' },
    });
    expect(okUrl).toMatch(/^http:\/\/localhost:3000\/login\/sso-callback#session=/);

    const errUrl = service.buildCmsErrorRedirectUrl('deu mal');
    expect(errUrl).toBe('http://localhost:3000/login/sso-callback#error=deu%20mal');
  });
});
