import {
  buildTotpUri,
  formatSecretForManualEntry,
  generateCurrentTotpCode,
  generateTotpSecret,
  verifyTotpCode,
} from './totp';

describe('totp', () => {
  it('gera um secret base32 não vazio', () => {
    const secret = generateTotpSecret();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(10);
  });

  it('constrói um otpauth:// URI com o issuer e email corretos', () => {
    const secret = generateTotpSecret();
    const uri = buildTotpUri('user@example.com', secret);
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('EasySignage');
    expect(uri).toContain(encodeURIComponent('user@example.com'));
  });

  it('valida um código gerado a partir do mesmo secret', () => {
    const secret = generateTotpSecret();
    const code = generateCurrentTotpCode(secret);
    expect(verifyTotpCode(secret, code)).toBe(true);
  });

  it('rejeita um código incorreto', () => {
    const secret = generateTotpSecret();
    const validCode = generateCurrentTotpCode(secret);
    const wrongCode = validCode === '000000' ? '111111' : '000000';
    expect(verifyTotpCode(secret, wrongCode)).toBe(false);
  });

  it('rejeita entradas que não são códigos numéricos de 6 dígitos', () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, 'abcdef')).toBe(false);
    expect(verifyTotpCode(secret, '12345')).toBe(false);
    expect(verifyTotpCode(secret, '')).toBe(false);
  });

  it('formata o secret em blocos de 4 caracteres para digitação manual', () => {
    expect(formatSecretForManualEntry('ABCDEFGHIJKL')).toBe('ABCD EFGH IJKL');
  });
});
