import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from 'node:crypto';
import { tierMaxPlayers, isLicenseTier, type LicenseTier } from './tiers.js';
import { isValidHardwareId, normalizeHardwareId } from './hwid.js';
import type { LicensePayloadV1 } from './types.js';

export type LicensedTier = Exclude<LicenseTier, 'TRIAL'>;

const SERIAL_PREFIX = 'ESGN1';

export type KeyPairPem = { publicKeyPem: string; privateKeyPem: string };

export function generateLicenseKeyPair(): KeyPairPem {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

function b64urlDecode(str: string): Buffer {
  const pad = (4 - (str.length % 4)) % 4;
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return Buffer.from(b64, 'base64');
}

export function buildLicensePayload(input: {
  hwid: string;
  tier: LicensedTier;
  issuedAt?: Date;
  expiresAt?: Date | null;
  customer?: string;
}): LicensePayloadV1 {
  const hwid = normalizeHardwareId(input.hwid);
  if (!isValidHardwareId(hwid)) {
    throw new Error('Hardware ID inválido');
  }
  if (!isLicenseTier(input.tier)) {
    throw new Error('Plano inválido');
  }
  return {
    v: 1,
    hwid,
    tier: input.tier,
    maxPlayers: tierMaxPlayers(input.tier),
    issuedAt: (input.issuedAt ?? new Date()).toISOString(),
    expiresAt: input.expiresAt ? input.expiresAt.toISOString() : null,
    ...(input.customer?.trim() ? { customer: input.customer.trim() } : {}),
  };
}

export function signLicense(
  payload: LicensePayloadV1,
  privateKeyPem: string
): string {
  const json = JSON.stringify(payload);
  const payloadPart = b64urlEncode(Buffer.from(json, 'utf8'));
  const key = createPrivateKey(privateKeyPem);
  const sig = sign(null, Buffer.from(json, 'utf8'), key);
  const sigPart = b64urlEncode(sig);
  return `${SERIAL_PREFIX}.${payloadPart}.${sigPart}`;
}

export type VerifyLicenseResult =
  | { ok: true; payload: LicensePayloadV1 }
  | { ok: false; reason: string };

export function verifyLicense(
  serial: string,
  publicKeyPem: string
): VerifyLicenseResult {
  const trimmed = serial.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3 || parts[0] !== SERIAL_PREFIX) {
    return { ok: false, reason: 'Formato de serial inválido' };
  }
  const [, payloadPart, sigPart] = parts;
  if (!payloadPart || !sigPart) {
    return { ok: false, reason: 'Serial incompleto' };
  }

  let json: string;
  try {
    json = b64urlDecode(payloadPart).toString('utf8');
  } catch {
    return { ok: false, reason: 'Payload inválido' };
  }

  let payload: LicensePayloadV1;
  try {
    payload = JSON.parse(json) as LicensePayloadV1;
  } catch {
    return { ok: false, reason: 'JSON inválido' };
  }

  if (payload.v !== 1) {
    return { ok: false, reason: 'Versão não suportada' };
  }
  if (!isValidHardwareId(payload.hwid)) {
    return { ok: false, reason: 'HWID no serial inválido' };
  }
  if (!isLicenseTier(payload.tier)) {
    return { ok: false, reason: 'Plano no serial inválido' };
  }
  if (payload.maxPlayers !== tierMaxPlayers(payload.tier)) {
    return { ok: false, reason: 'Limite de players inconsistente' };
  }
  if (payload.expiresAt) {
    const exp = new Date(payload.expiresAt);
    if (Number.isNaN(exp.getTime())) {
      return { ok: false, reason: 'Data de expiração inválida' };
    }
    if (exp.getTime() < Date.now()) {
      return { ok: false, reason: 'Licença expirada' };
    }
  }

  try {
    const key = createPublicKey(publicKeyPem);
    const sig = b64urlDecode(sigPart);
    const valid = verify(null, Buffer.from(json, 'utf8'), key, sig);
    if (!valid) {
      return { ok: false, reason: 'Assinatura inválida' };
    }
  } catch {
    return { ok: false, reason: 'Falha na verificação da assinatura' };
  }

  return { ok: true, payload };
}

export function formatSerialForDisplay(serial: string): string {
  const compact = serial.replace(/\s+/gu, '');
  const chunks: string[] = [];
  for (let i = 0; i < compact.length; i += 8) {
    chunks.push(compact.slice(i, i + 8));
  }
  return chunks.join('-');
}
