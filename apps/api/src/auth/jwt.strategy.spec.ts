import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

function buildStrategy() {
  const config = { get: jest.fn().mockReturnValue('test-secret') };
  return new JwtStrategy(config as any);
}

describe('JwtStrategy', () => {
  it('aceita um payload de sessão normal', () => {
    const strategy = buildStrategy();
    const user = strategy.validate({
      sub: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@b.com',
      permissions: ['*'],
    });
    expect(user).toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@b.com',
      permissions: ['*'],
    });
  });

  it('rejeita um payload de desafio de 2FA (purpose definido)', () => {
    const strategy = buildStrategy();
    expect(() =>
      strategy.validate({
        sub: 'user-1',
        tenantId: 'tenant-1',
        email: 'a@b.com',
        purpose: '2fa-challenge',
      })
    ).toThrow(UnauthorizedException);
  });

  it('rejeita payloads sem sub ou tenantId', () => {
    const strategy = buildStrategy();
    expect(() => strategy.validate({ sub: '', tenantId: 'tenant-1', email: 'a@b.com' })).toThrow(
      UnauthorizedException
    );
    expect(() => strategy.validate({ sub: 'user-1', tenantId: '', email: 'a@b.com' })).toThrow(
      UnauthorizedException
    );
  });
});
