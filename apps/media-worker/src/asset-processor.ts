import { execFile } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { AssetUploadedJobData } from '@easysignage/shared-types';
import { type QueryClient, getAssetForProcessing, updateAssetMetadata } from './db.js';
import { readImageDimensions, writeImageThumbnail } from './image-processor.js';
import { EMPTY_VIDEO_METADATA, probeVideo } from './ffprobe.js';
import { buildVideoThumbnailArgs, resolveFfmpegPath } from './video-thumbnail.js';

const execFileAsync = promisify(execFile);
const EXEC_OPTS = { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 };

export function storageRoot(env: Record<string, string | undefined> = process.env): string {
  return env.STORAGE_ROOT?.trim() || join(process.cwd(), 'uploads');
}

function thumbnailKeyFor(tenantId: string, assetId: string): string {
  return join(tenantId, `${assetId}_thumb.jpg`).replace(/\\/g, '/');
}

async function processImage(
  db: QueryClient,
  assetId: string,
  tenantId: string,
  absPath: string
): Promise<void> {
  const buf = await readFile(absPath);
  const dims = await readImageDimensions(buf);

  const thumbKey = thumbnailKeyFor(tenantId, assetId);
  const root = storageRoot();
  await mkdir(join(root, tenantId), { recursive: true });
  const ok = await writeImageThumbnail(buf, join(root, thumbKey));

  await updateAssetMetadata(db, assetId, {
    thumbnailKey: ok ? thumbKey : null,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  });
}

async function processVideo(
  db: QueryClient,
  assetId: string,
  tenantId: string,
  absPath: string
): Promise<void> {
  let metadata = EMPTY_VIDEO_METADATA;
  try {
    metadata = await probeVideo(absPath, (cmd, args) => execFileAsync(cmd, args, EXEC_OPTS));
  } catch {
    /** ffprobe indisponível ou falhou — segue sem metadados de vídeo. */
  }

  const thumbKey = thumbnailKeyFor(tenantId, assetId);
  const root = storageRoot();
  await mkdir(join(root, tenantId), { recursive: true });
  let thumbOk = false;
  try {
    await execFileAsync(
      resolveFfmpegPath(),
      buildVideoThumbnailArgs(absPath, join(root, thumbKey)),
      EXEC_OPTS
    );
    thumbOk = true;
  } catch {
    thumbOk = false;
  }

  await updateAssetMetadata(db, assetId, {
    thumbnailKey: thumbOk ? thumbKey : null,
    width: metadata.width,
    height: metadata.height,
    durationMs: metadata.durationMs,
    videoCodec: metadata.videoCodec,
    audioCodec: metadata.audioCodec,
  });
}

/**
 * Processa o job `asset.uploaded`: lê o ficheiro do storage partilhado,
 * extrai metadados/miniatura e grava o resultado em `Asset` via SQL direto
 * (ver `./db.ts`). Assets sem `storageKey` (URL/RTSP) ou de tipos não
 * tratados (áudio, PDF, html, texto) são ignorados silenciosamente.
 */
export async function processAssetUploaded(
  db: QueryClient,
  data: AssetUploadedJobData
): Promise<void> {
  const asset = await getAssetForProcessing(db, data.assetId);
  if (!asset || !asset.storageKey) return;

  const absPath = join(storageRoot(), asset.storageKey);

  if (asset.kind === 'image') {
    await processImage(db, asset.id, asset.tenantId, absPath);
    return;
  }
  if (asset.kind === 'video') {
    await processVideo(db, asset.id, asset.tenantId, absPath);
  }
}
