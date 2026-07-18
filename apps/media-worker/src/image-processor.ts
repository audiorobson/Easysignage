import sharp from 'sharp';

export interface ImageDimensions {
  width: number;
  height: number;
}

/** Falha silenciosa (ex.: SVG sem viewBox, ficheiro corrompido). */
export async function readImageDimensions(buf: Buffer): Promise<ImageDimensions | null> {
  try {
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) return null;
    return { width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

/** JPEG ~320px para pré-visualização CMS; falha silenciosa. */
export async function writeImageThumbnail(buf: Buffer, outPath: string): Promise<boolean> {
  try {
    await sharp(buf)
      .rotate()
      .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(outPath);
    return true;
  } catch {
    return false;
  }
}
