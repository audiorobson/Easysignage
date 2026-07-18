/**
 * Fase 6, PR 6.2 — sanitização do que é gravado na trilha de auditoria.
 * Nunca deve chegar à base de dados: passwords, secrets, tokens de sessão,
 * chaves de licença completas etc. Também trunca payloads grandes (upload de
 * media em base64, listas longas) para manter as linhas de `audit_logs` leves.
 */

const REDACTED = '[REDACTED]';
const MAX_STRING_LENGTH = 2000;
const MAX_DEPTH = 6;

const SENSITIVE_KEY_PATTERN =
  /(password|senha|secret|token|totp|authorization|apikey|api_key|licensekey|license_key|webhooksecret)/i;

export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (value == null) return value;

  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncado, ${value.length} chars]`
      : value;
  }

  if (typeof value !== 'object') return value;

  if (depth >= MAX_DEPTH) return '[profundidade máxima excedida]';

  if (Array.isArray(value)) {
    const MAX_ITEMS = 50;
    const items = value.slice(0, MAX_ITEMS).map((v) => sanitizeForAudit(v, depth + 1));
    if (value.length > MAX_ITEMS) {
      items.push(`…[+${value.length - MAX_ITEMS} itens]`);
    }
    return items;
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeForAudit(val, depth + 1);
  }
  return out;
}
