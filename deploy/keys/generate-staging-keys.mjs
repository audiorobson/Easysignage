#!/usr/bin/env node
/**
 * Par de chaves Ed25519 para ambiente de TESTE DE PRODUÇÃO (staging).
 * A chave pública (staging-public.pem) pode ser commitada; a privada fica gitignored.
 */
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const privPath = join(dir, 'staging-private.pem');
const pubPath = join(dir, 'staging-public.pem');

if (existsSync(privPath) && existsSync(pubPath)) {
  console.log('Chaves staging já existem em deploy/keys/');
  process.exit(0);
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }));
console.log('Chaves staging gravadas:');
console.log('  ', pubPath);
console.log('  ', privPath);
