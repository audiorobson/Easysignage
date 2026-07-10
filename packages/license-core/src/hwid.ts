import { createHash } from 'node:crypto';

const HWID_PREFIX = 'ES-';
const HWID_BODY_LEN = 26;
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Formato público: ES- + 26 caracteres base32 (sem I/L/O/U). */
export const HWID_PATTERN = /^ES-[0-9A-HJKMNP-TV-Z]{26}$/;

export function isValidHardwareId(hwid: string): boolean {
  return HWID_PATTERN.test(hwid.trim().toUpperCase());
}

/** Deriva Hardware ID estável a partir de sinais do host (ordenados). */
export function deriveHardwareId(sources: string[]): string {
  const canonical = sources
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join('|');
  const digest = createHash('sha256').update(canonical, 'utf8').digest();
  let body = '';
  let bits = 0;
  let value = 0;
  for (let i = 0; i < digest.length && body.length < HWID_BODY_LEN; i++) {
    value = (value << 8) | digest[i]!;
    bits += 8;
    while (bits >= 5 && body.length < HWID_BODY_LEN) {
      bits -= 5;
      const idx = (value >> bits) & 31;
      body += BASE32[idx] ?? '0';
    }
  }
  while (body.length < HWID_BODY_LEN) {
    body += '0';
  }
  return `${HWID_PREFIX}${body}`;
}

export function normalizeHardwareId(raw: string): string {
  return raw.trim().toUpperCase();
}
