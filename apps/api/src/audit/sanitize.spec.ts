import { sanitizeForAudit } from './sanitize';

describe('sanitizeForAudit', () => {
  it('mantém valores primitivos e null/undefined inalterados', () => {
    expect(sanitizeForAudit(null)).toBeNull();
    expect(sanitizeForAudit(undefined)).toBeUndefined();
    expect(sanitizeForAudit(42)).toBe(42);
    expect(sanitizeForAudit(true)).toBe(true);
  });

  it('trunca strings muito longas', () => {
    const long = 'a'.repeat(3000);
    const result = sanitizeForAudit(long) as string;
    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain('truncado');
  });

  it('mascara chaves sensíveis por nome (case-insensitive)', () => {
    const input = {
      password: 'segredo123',
      Password: 'outroSegredo',
      totpSecret: 'ABCD1234',
      alertWebhookSecret: 'whsec_xxx',
      licenseKey: 'ESGN1.xxxx',
      authorization: 'Bearer xxx',
      name: 'Dispositivo Sala 1',
    };
    const result = sanitizeForAudit(input) as Record<string, unknown>;
    expect(result.password).toBe('[REDACTED]');
    expect(result.Password).toBe('[REDACTED]');
    expect(result.totpSecret).toBe('[REDACTED]');
    expect(result.alertWebhookSecret).toBe('[REDACTED]');
    expect(result.licenseKey).toBe('[REDACTED]');
    expect(result.authorization).toBe('[REDACTED]');
    expect(result.name).toBe('Dispositivo Sala 1');
  });

  it('sanitiza recursivamente objetos e arrays aninhados', () => {
    const input = {
      device: { name: 'D1', credentials: { password: 'x' } },
      items: [{ password: 'y' }, { name: 'ok' }],
    };
    const result = sanitizeForAudit(input) as any;
    expect(result.device.credentials.password).toBe('[REDACTED]');
    expect(result.items[0].password).toBe('[REDACTED]');
    expect(result.items[1].name).toBe('ok');
  });

  it('limita o número de itens de arrays grandes', () => {
    const arr = Array.from({ length: 80 }, (_, i) => i);
    const result = sanitizeForAudit(arr) as unknown[];
    expect(result.length).toBe(51); // 50 items + marcador de corte
    expect(String(result[50])).toContain('+30 itens');
  });

  it('limita a profundidade de recursão para evitar objetos ciclicos/gigantes', () => {
    let deep: Record<string, unknown> = { value: 'leaf' };
    for (let i = 0; i < 20; i++) {
      deep = { nested: deep };
    }
    const result = sanitizeForAudit(deep);
    expect(JSON.stringify(result)).toContain('profundidade máxima excedida');
  });
});
