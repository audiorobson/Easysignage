import { describe, expect, it, vi } from 'vitest';
import { getAssetForProcessing, updateAssetMetadata } from './db.js';

function fakeDb(rows: unknown[] = []) {
  return { query: vi.fn().mockResolvedValue({ rows }) };
}

describe('getAssetForProcessing', () => {
  it('devolve o asset quando encontrado', async () => {
    const db = fakeDb([
      { id: 'a1', tenantId: 't1', kind: 'image', mimeType: 'image/png', storageKey: 't1/a1.png' },
    ]);

    const asset = await getAssetForProcessing(db, 'a1');

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM assets'), ['a1']);
    expect(asset).toEqual({
      id: 'a1',
      tenantId: 't1',
      kind: 'image',
      mimeType: 'image/png',
      storageKey: 't1/a1.png',
    });
  });

  it('devolve null quando não encontrado', async () => {
    const db = fakeDb([]);
    expect(await getAssetForProcessing(db, 'inexistente')).toBeNull();
  });
});

describe('updateAssetMetadata', () => {
  it('envia todos os campos de metadata na ordem esperada', async () => {
    const db = fakeDb();

    await updateAssetMetadata(db, 'a1', {
      thumbnailKey: 't1/a1_thumb.jpg',
      width: 1920,
      height: 1080,
      durationMs: 12345,
      videoCodec: 'h264',
      audioCodec: 'aac',
    });

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE assets'), [
      'a1',
      't1/a1_thumb.jpg',
      1920,
      1080,
      12345,
      'h264',
      'aac',
    ]);
  });

  it('usa null para campos omitidos (COALESCE preserva thumbnail existente)', async () => {
    const db = fakeDb();

    await updateAssetMetadata(db, 'a2', {});

    expect(db.query).toHaveBeenCalledWith(expect.any(String), [
      'a2',
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});
