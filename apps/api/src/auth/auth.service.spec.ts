import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { generateCurrentTotpCode, generateTotpSecret } from './totp';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcrypt');

const TENANT = { id: 'tenant-1', name: 'Acme', slug: 'acme', status: 'active' };

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    tenantId: TENANT.id,
    name: 'Ana',
    email: 'ana@acme.com',
    passwordHash: 'hash',
    status: 'active',
    totpSecret: null as string | null,
    totpEnabled: false,
    tenant: TENANT,
    userRoles: [{ role: { permissionsJson: { all: true } } }],
    ...overrides,
  };
}

function buildPrismaMock(user: ReturnType<typeof buildUser> | null) {
  return {
    tenant: {
      findUnique: jest.fn().mockResolvedValue(TENANT),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...user, ...data })),
    },
  };
}

function buildJwtMock() {
  const tokens = new Map<string, Record<string, unknown>>();
  let counter = 0;
  return {
    signAsync: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
      const token = `token-${counter++}`;
      tokens.set(token, payload);
      return Promise.resolve(token);
    }),
    verifyAsync: jest.fn().mockImplementation((token: string) => {
      const payload = tokens.get(token);
      if (!payload) return Promise.reject(new Error('invalid token'));
      return Promise.resolve(payload);
    }),
  };
}

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('emite um token de sessão quando as credenciais estão corretas e 2FA está desativado', async () => {
      bcrypt.compare.mockResolvedValue(true);
      const prisma = buildPrismaMock(buildUser());
      const jwt = buildJwtMock();
      const service = new AuthService(prisma as any, jwt as any);

      const result = await service.login('acme', 'ana@acme.com', 'secret');

      expect(result).toMatchObject({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        user: { id: 'user-1', email: 'ana@acme.com' },
        tenant: { id: 'tenant-1', slug: 'acme' },
      });
      expect((result as any).requires2fa).toBeUndefined();
    });

    it('rejeita credenciais inválidas', async () => {
      bcrypt.compare.mockResolvedValue(false);
      const prisma = buildPrismaMock(buildUser());
      const jwt = buildJwtMock();
      const service = new AuthService(prisma as any, jwt as any);

      await expect(service.login('acme', 'ana@acme.com', 'wrong')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('retorna um desafio de 2FA (sem accessToken) quando o utilizador tem TOTP ativado', async () => {
      bcrypt.compare.mockResolvedValue(true);
      const secret = generateTotpSecret();
      const prisma = buildPrismaMock(buildUser({ totpEnabled: true, totpSecret: secret }));
      const jwt = buildJwtMock();
      const service = new AuthService(prisma as any, jwt as any);

      const result = await service.login('acme', 'ana@acme.com', 'secret');

      expect(result).toMatchObject({ requires2fa: true, challengeToken: expect.any(String) });
      expect((result as any).accessToken).toBeUndefined();
    });
  });

  describe('completeTwoFactorLogin', () => {
    it('emite o token de sessão quando o código TOTP é válido', async () => {
      bcrypt.compare.mockResolvedValue(true);
      const secret = generateTotpSecret();
      const user = buildUser({ totpEnabled: true, totpSecret: secret });
      const prisma = buildPrismaMock(user);
      const jwt = buildJwtMock();
      const service = new AuthService(prisma as any, jwt as any);

      const { challengeToken } = (await service.login('acme', 'ana@acme.com', 'secret')) as {
        challengeToken: string;
      };
      const code = generateCurrentTotpCode(secret);

      const result = await service.completeTwoFactorLogin(challengeToken, code);

      expect(result).toMatchObject({ accessToken: expect.any(String), tokenType: 'Bearer' });
    });

    it('rejeita um código TOTP incorreto', async () => {
      const secret = generateTotpSecret();
      const user = buildUser({ totpEnabled: true, totpSecret: secret });
      const prisma = buildPrismaMock(user);
      const jwt = buildJwtMock();
      const service = new AuthService(prisma as any, jwt as any);

      const challengeToken = await jwt.signAsync({
        sub: user.id,
        tenantId: TENANT.id,
        purpose: '2fa-challenge',
      });
      const validCode = generateCurrentTotpCode(secret);
      const wrongCode = validCode === '000000' ? '111111' : '000000';

      await expect(service.completeTwoFactorLogin(challengeToken, wrongCode)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('rejeita um challenge token sem o purpose correto', async () => {
      const user = buildUser({ totpEnabled: true, totpSecret: generateTotpSecret() });
      const prisma = buildPrismaMock(user);
      const jwt = buildJwtMock();
      const service = new AuthService(prisma as any, jwt as any);

      const fakeAccessToken = await jwt.signAsync({
        sub: user.id,
        tenantId: TENANT.id,
        email: user.email,
        permissions: ['*'],
      });

      await expect(service.completeTwoFactorLogin(fakeAccessToken, '123456')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('rejeita um challenge token expirado/invalido', async () => {
      const user = buildUser({ totpEnabled: true, totpSecret: generateTotpSecret() });
      const prisma = buildPrismaMock(user);
      const jwt = buildJwtMock();
      const service = new AuthService(prisma as any, jwt as any);

      await expect(service.completeTwoFactorLogin('token-invalido', '123456')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('setupTwoFactor / confirmTwoFactor / disableTwoFactor', () => {
    it('gera um secret pendente e um QR code em setupTwoFactor', async () => {
      const user = buildUser();
      const prisma = buildPrismaMock(user);
      const jwt = buildJwtMock();
      const service = new AuthService(prisma as any, jwt as any);

      const result = await service.setupTwoFactor(user.id);

      expect(result.secret).toMatch(/^[A-Z2-7 ]+$/);
      expect(result.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
      expect(result.qrDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { totpSecret: expect.any(String), totpEnabled: false },
      });
    });

    it('confirma o setup quando o código informado é válido para o secret pendente', async () => {
      const secret = generateTotpSecret();
      const user = buildUser({ totpSecret: secret, totpEnabled: false });
      const prisma = buildPrismaMock(user);
      const jwt = buildJwtMock();
      const service = new AuthService(prisma as any, jwt as any);

      const code = generateCurrentTotpCode(secret);
      const result = await service.confirmTwoFactor(user.id, code);

      expect(result).toEqual({ totpEnabled: true });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { totpEnabled: true },
      });
    });

    it('rejeita a confirmação quando não há setup pendente', async () => {
      const user = buildUser({ totpSecret: null });
      const prisma = buildPrismaMock(user);
      const jwt = buildJwtMock();
      const service = new AuthService(prisma as any, jwt as any);

      await expect(service.confirmTwoFactor(user.id, '123456')).rejects.toThrow(
        BadRequestException
      );
    });

    it('desativa o 2FA e limpa o secret quando o código é válido', async () => {
      const secret = generateTotpSecret();
      const user = buildUser({ totpSecret: secret, totpEnabled: true });
      const prisma = buildPrismaMock(user);
      const jwt = buildJwtMock();
      const service = new AuthService(prisma as any, jwt as any);

      const code = generateCurrentTotpCode(secret);
      const result = await service.disableTwoFactor(user.id, code);

      expect(result).toEqual({ totpEnabled: false });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { totpEnabled: false, totpSecret: null },
      });
    });

    it('rejeita desativação com código incorreto', async () => {
      const secret = generateTotpSecret();
      const user = buildUser({ totpSecret: secret, totpEnabled: true });
      const prisma = buildPrismaMock(user);
      const jwt = buildJwtMock();
      const service = new AuthService(prisma as any, jwt as any);

      const validCode = generateCurrentTotpCode(secret);
      const wrongCode = validCode === '000000' ? '111111' : '000000';

      await expect(service.disableTwoFactor(user.id, wrongCode)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('rejeita desativação quando 2FA não está ativado', async () => {
      const user = buildUser({ totpEnabled: false, totpSecret: null });
      const prisma = buildPrismaMock(user);
      const jwt = buildJwtMock();
      const service = new AuthService(prisma as any, jwt as any);

      await expect(service.disableTwoFactor(user.id, '123456')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('getTotpStatus', () => {
    it('retorna o estado atual de ativação do 2FA', async () => {
      const user = buildUser({ totpEnabled: true });
      const prisma = buildPrismaMock(user);
      const jwt = buildJwtMock();
      const service = new AuthService(prisma as any, jwt as any);

      await expect(service.getTotpStatus(user.id)).resolves.toEqual({ totpEnabled: true });
    });
  });
});
