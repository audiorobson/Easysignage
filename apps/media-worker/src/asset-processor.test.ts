import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processAssetUploaded } from './asset-processor.js';

/**
 * Integração ponta-a-ponta com Postgres real (PR 5.15): cria um tenant e um
 * asset de imagem temporários, grava o ficheiro no `STORAGE_ROOT`, processa
 * o job e confirma que `assets.thumbnail_key`/`width_px`/`height_px` foram
 * atualizados na base de dados. Requer `DATABASE_URL` — se indisponível, o
 * teste é ignorado (ver padrão análogo em `apps/api/src/queue/media-queue.service.spec.ts`).
 */
describe('processAssetUploaded (integração Postgres + storage)', () => {
  let pool: Pool | null = null;
  let dbAvailable = false;
  let storageDir: string;

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'es-media-worker-storage-'));
    process.env.STORAGE_ROOT = storageDir;

    const url = process.env.DATABASE_URL;
    if (!url) return;
    pool = new Pool({ connectionString: url, connectionTimeoutMillis: 8_000 });
    try {
      await pool.query('SELECT 1');
      dbAvailable = true;
    } catch {
      dbAvailable = false;
    }
  }, 20_000);

  afterAll(async () => {
    await pool?.end().catch(() => {});
    await rm(storageDir, { recursive: true, force: true });
    delete process.env.STORAGE_ROOT;
  }, 15_000);

  it('processa um asset de imagem: gera miniatura e grava dimensões', async () => {
    if (!dbAvailable || !pool) {
      console.warn('DATABASE_URL indisponível — teste de integração ignorado.');
      return;
    }

    const tenantId = randomUUID();
    const assetId = randomUUID();
    const storageKey = `${tenantId}/${assetId}.png`;

    await pool.query(
      `INSERT INTO tenants (id, name, slug, status, updated_at)
       VALUES ($1, 'Media Worker Test', $2, 'active', now())`,
      [tenantId, `media-worker-test-${tenantId.slice(0, 8)}`]
    );
    await pool.query(
      `INSERT INTO assets (id, tenant_id, name, kind, mime_type, storage_key, file_size, status)
       VALUES ($1, $2, 'teste.png', 'image', 'image/png', $3, 0, 'ready')`,
      [assetId, tenantId, storageKey]
    );

    await mkdir(join(storageDir, tenantId), { recursive: true });
    const buf = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 5, g: 5, b: 200 } },
    })
      .png()
      .toBuffer();
    await writeFile(join(storageDir, storageKey), buf);

    try {
      await processAssetUploaded(pool, { tenantId, assetId, kind: 'image' });

      const { rows } = await pool.query(
        `SELECT thumbnail_key AS "thumbnailKey", width_px AS "width", height_px AS "height", processed_at AS "processedAt"
         FROM assets WHERE id = $1`,
        [assetId]
      );
      const row = rows[0] as {
        thumbnailKey: string | null;
        width: number | null;
        height: number | null;
        processedAt: Date | null;
      };

      expect(row.thumbnailKey).toBe(`${tenantId}/${assetId}_thumb.jpg`);
      expect(row.width).toBe(800);
      expect(row.height).toBe(600);
      expect(row.processedAt).not.toBeNull();
    } finally {
      await pool.query('DELETE FROM assets WHERE id = $1', [assetId]);
      await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
    }
  }, 20_000);

  it('ignora silenciosamente asset inexistente (job atrasado após remoção)', async () => {
    if (!dbAvailable || !pool) {
      console.warn('DATABASE_URL indisponível — teste de integração ignorado.');
      return;
    }
    await expect(
      processAssetUploaded(pool, {
        tenantId: randomUUID(),
        assetId: randomUUID(),
        kind: 'image',
      })
    ).resolves.toBeUndefined();
  });
});
