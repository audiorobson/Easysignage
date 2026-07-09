import { createHash, randomBytes } from 'node:crypto';

const PAIRING_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function generateDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

export function generatePairingCode(length = 8): string {
  const buf = randomBytes(length);
  let s = '';
  for (let i = 0; i < length; i++) {
    s += PAIRING_CHARS[buf[i]! % PAIRING_CHARS.length];
  }
  return s;
}
