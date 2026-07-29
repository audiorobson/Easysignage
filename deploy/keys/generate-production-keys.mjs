#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const outFlag = process.argv.indexOf('--out');
const outDir = outFlag >= 0 ? resolve(process.argv[outFlag + 1] ?? dir) : dir;
const privPath = join(outDir, 'production-private.pem');
const pubPath = join(outDir, 'production-public.pem');

if (existsSync(privPath)) {
  console.error('Ja existe:', privPath);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o644 });
console.log('Par de producao gerado:');
console.log('  Privada (COFRE):', privPath);
console.log('  Publica (mini PC):', pubPath);