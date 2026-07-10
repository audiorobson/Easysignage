#!/usr/bin/env node
/**
 * Gera ZIP de distribuição do Server Box para mini PC.
 * Uso: node deploy/release/build-server-box-zip.mjs
 */
import { createWriteStream, mkdirSync, readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const root = join(fileURLToPath(import.meta.url), '../../..');
const version = (process.env.EASYSIGNAGE_VERSION ?? 'dev').replace(/^v/u, '');
const outDir = join(root, 'dist', 'release');
const zipPath = join(outDir, `easysignage-server-box-${version}.zip`);
const prefix = 'easysignage-server-box';

function walk(archive, absDir, zipDir) {
  for (const name of readdirSync(absDir)) {
    const abs = join(absDir, name);
    const zipName = zipDir ? `${zipDir}/${name}` : name;
    if (statSync(abs).isDirectory()) {
      walk(archive, abs, zipName);
    } else {
      archive.file(abs, { name: `${prefix}/${zipName}` });
    }
  }
}

mkdirSync(outDir, { recursive: true });

await new Promise((resolve, reject) => {
  const output = createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  output.on('close', resolve);
  archive.on('error', reject);
  archive.pipe(output);

  walk(archive, join(root, 'deploy/server-box'), '');
  walk(archive, join(root, 'deploy/hwid'), 'hwid');
  const stagingPub = join(root, 'deploy/keys/staging-public.pem');
  if (existsSync(stagingPub)) {
    archive.file(stagingPub, { name: `${prefix}/config/license-public.pem` });
  } else {
    archive.file(join(root, 'deploy/keys/production-public.pem.example'), {
      name: `${prefix}/config/license-public.pem.example`,
    });
  }
  archive.file(join(root, 'deploy/keys/README.md'), {
    name: `${prefix}/keys-README.md`,
  });
  archive.file(join(root, 'docs/manual-instalacao-mini-pc.md'), {
    name: `${prefix}/manual-instalacao-mini-pc.md`,
  });
  archive.file(join(root, 'docs/teste-producao.md'), {
    name: `${prefix}/teste-producao.md`,
  });
  archive.append(
    `EasySignage Server Box ${version}\r\n\r\n` +
      `1. Copie .env.example para .env e ajuste IP do mini PC\r\n` +
      `2. Execute install.ps1 (Windows) ou install.sh (Linux)\r\n` +
      `3. Configure imagens GHCR no .env OU importe imagens Docker\r\n` +
      `4. docker compose up -d\r\n` +
      `5. CMS http://localhost:3000 — login admin@demo.local / admin123\r\n` +
      `6. Ver teste-producao.md para licenca staging\r\n`,
    { name: `${prefix}/LEIA-ME.txt` }
  );

  void archive.finalize();
});

console.log(zipPath);
