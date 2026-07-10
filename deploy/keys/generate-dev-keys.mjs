#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const privPath = join(dir, 'dev-private.pem');
const pubPath = join(dir, 'dev-public.pem');

if (existsSync(privPath)) {
  console.error('dev-private.pem já existe — remova manualmente para regenerar.');
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
mkdirSync(dir, { recursive: true });
writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }));
console.log('Chaves gravadas em deploy/keys/ (gitignored para *.pem)');
