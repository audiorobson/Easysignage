#!/usr/bin/env node
/**
 * Gera serial de licença para teste de produção (usa staging-private.pem).
 * Uso: node deploy/release/generate-test-license.mjs --hwid ES-... --tier STD
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildLicensePayload,
  formatSerialForDisplay,
  isLicenseTier,
  isValidHardwareId,
  signLicense,
  tierLabelPt,
} from '../../packages/license-core/dist/index.js';

const dir = dirname(fileURLToPath(import.meta.url));
const keysDir = join(dir, '../keys');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const hwid = (arg('hwid') ?? '').trim().toUpperCase();
const tier = (arg('tier') ?? 'STD').trim().toUpperCase();
const customer = arg('customer') ?? 'Teste produção';

if (!isValidHardwareId(hwid)) {
  console.error('HWID inválido. Use --hwid ES-...');
  process.exit(1);
}
if (!isLicenseTier(tier) || tier === 'TRIAL') {
  console.error('Tier inválido. Use LITE, STD ou ELITE.');
  process.exit(1);
}

const privPath = join(keysDir, 'staging-private.pem');
if (!existsSync(privPath)) {
  console.error('staging-private.pem ausente. Execute: pnpm license:gen-staging-keys');
  process.exit(1);
}

const privateKeyPem = readFileSync(privPath, 'utf8');
const payload = buildLicensePayload({ hwid, tier, customer, expiresAt: null });
const serial = signLicense(payload, privateKeyPem);
const display = formatSerialForDisplay(serial);

console.log(`Plano: ${tierLabelPt(tier)}`);
console.log(`HWID:  ${hwid}`);
console.log('');
console.log(display);
