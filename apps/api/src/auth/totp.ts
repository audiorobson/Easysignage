import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

const ISSUER = 'EasySignage';

authenticator.options = { window: 1 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildTotpUri(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function buildTotpQrDataUrl(email: string, secret: string): Promise<string> {
  const uri = buildTotpUri(email, secret);
  return QRCode.toDataURL(uri);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  if (!code || !/^\d{6}$/.test(code.trim())) {
    return false;
  }
  try {
    return authenticator.check(code.trim(), secret);
  } catch {
    return false;
  }
}

/** Usado apenas em testes/manual — gera o código válido atual para um secret. */
export function generateCurrentTotpCode(secret: string): string {
  return authenticator.generate(secret);
}

export function formatSecretForManualEntry(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}
