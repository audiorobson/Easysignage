#!/usr/bin/env node
/**
 * Wrapper multiplataforma para scripts/setup-github-access.ps1
 * Uso: node scripts/run-gh-access.mjs [args...]
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, 'setup-github-access.ps1');
const extra = process.argv.slice(2).filter((arg) => arg !== '--');
const psArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...extra];

for (const cmd of ['pwsh', 'powershell']) {
  const result = spawnSync(cmd, psArgs, { stdio: 'inherit' });
  if (result.error?.code === 'ENOENT') continue;
  process.exit(result.status ?? 1);
}

console.error('PowerShell nao encontrado. Instale PowerShell 7 (pwsh) ou use Windows PowerShell.');
process.exit(1);
