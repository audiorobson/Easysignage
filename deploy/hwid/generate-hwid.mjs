#!/usr/bin/env node
/**
 * Gera Hardware ID estável para o mini PC (executar no HOST, não dentro do Docker).
 * Uso: node deploy/hwid/generate-hwid.mjs [--out config/hardware.id]
 */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hostname, platform } from 'node:os';
import { dirname, resolve } from 'node:path';

const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function deriveHardwareId(sources) {
  const canonical = sources
    .map((s) => String(s).trim())
    .filter(Boolean)
    .sort()
    .join('|');
  const digest = createHash('sha256').update(canonical, 'utf8').digest();
  let body = '';
  let bits = 0;
  let value = 0;
  for (let i = 0; i < digest.length && body.length < 26; i++) {
    value = (value << 8) | digest[i];
    bits += 8;
    while (bits >= 5 && body.length < 26) {
      bits -= 5;
      body += BASE32[(value >> bits) & 31];
    }
  }
  while (body.length < 26) body += '0';
  return `ES-${body}`;
}

function readLinuxMachineId() {
  for (const p of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
    try {
      if (existsSync(p)) return readFileSync(p, 'utf8').trim();
    } catch {
      /* ignore */
    }
  }
  return '';
}

function readLinuxBoardSerial() {
  try {
    if (existsSync('/sys/class/dmi/id/board_serial')) {
      return readFileSync('/sys/class/dmi/id/board_serial', 'utf8').trim();
    }
  } catch {
    /* ignore */
  }
  return '';
}

function readWindowsMachineGuid() {
  if (platform() !== 'win32') return '';
  try {
    const out = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const m = /MachineGuid\s+REG_SZ\s+(\S+)/i.exec(out);
    return m?.[1]?.trim() ?? '';
  } catch {
    return '';
  }
}

function readWindowsBiosSerial() {
  if (platform() !== 'win32') return '';
  try {
    const out = execSync(
      'powershell -NoProfile -Command "(Get-CimInstance Win32_BIOS).SerialNumber"',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    return out.trim();
  } catch {
    return '';
  }
}

function collectSources() {
  const sources = [hostname(), platform(), process.arch];
  if (platform() === 'win32') {
    sources.push(readWindowsMachineGuid(), readWindowsBiosSerial());
  } else {
    sources.push(readLinuxMachineId(), readLinuxBoardSerial());
  }
  return sources.filter(Boolean);
}

function parseOutArg() {
  const idx = process.argv.indexOf('--out');
  if (idx >= 0 && process.argv[idx + 1]) {
    return resolve(process.cwd(), process.argv[idx + 1]);
  }
  return resolve(process.cwd(), 'config/hardware.id');
}

const hwid = deriveHardwareId(collectSources());
const outPath = parseOutArg();
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${hwid}\n`, 'utf8');
console.log(hwid);
console.log(`Gravado em ${outPath}`);
