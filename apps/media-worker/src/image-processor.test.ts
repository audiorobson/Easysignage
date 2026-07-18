import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readImageDimensions, writeImageThumbnail } from './image-processor.js';

async function makePngBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 200, b: 40 } },
  })
    .png()
    .toBuffer();
}

describe('readImageDimensions', () => {
  it('lê largura/altura de um PNG válido', async () => {
    const buf = await makePngBuffer(640, 360);
    expect(await readImageDimensions(buf)).toEqual({ width: 640, height: 360 });
  });

  it('devolve null para bytes inválidos (falha silenciosa)', async () => {
    expect(await readImageDimensions(Buffer.from('não é imagem'))).toBeNull();
  });
});

describe('writeImageThumbnail', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'es-media-worker-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('gera um JPEG redimensionado (fit inside, sem ampliar)', async () => {
    const buf = await makePngBuffer(1000, 500);
    const outPath = join(dir, 'thumb.jpg');

    const ok = await writeImageThumbnail(buf, outPath);
    expect(ok).toBe(true);

    const written = await readFile(outPath);
    const meta = await sharp(written).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBeLessThanOrEqual(320);
    expect(meta.height).toBeLessThanOrEqual(320);
  });

  it('devolve false (falha silenciosa) para bytes inválidos', async () => {
    const outPath = join(dir, 'thumb.jpg');
    const ok = await writeImageThumbnail(Buffer.from('lixo'), outPath);
    expect(ok).toBe(false);
  });
});
