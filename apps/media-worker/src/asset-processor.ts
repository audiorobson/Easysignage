import { execFile } from 'node:child_process';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { AssetUploadedJobData } from '@easysignage/shared-types';
import { type QueryClient, getAssetForProcessing, updateAssetMetadata } from './db.js';
import { readImageDimensions, writeImageThumbnail } from './image-processor.js';
import { EMPTY_VIDEO_METADATA, type VideoMetadata, probeVideo } from './ffprobe.js';
import { buildVideoThumbnailArgs, resolveFfmpegPath } from './video-thumbnail.js';
import { buildNormalizeArgs, needsNormalization } from './normalization.js';

const execFileAsync = promisify(execFile);
const EXEC_OPTS = { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 };
const NORMALIZE_OPTS = { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 };
const NORMALIZED_MIME_TYPE = 'video/mp4';

export function storageRoot(env: Record<string, string | undefined> = process.env): string {
  return env.STORAGE_ROOT?.trim() || join(process.cwd(), 'uploads');
}

function thumbnailKeyFor(tenantId: string, assetId: string): string {
  return join(tenantId, `${assetId}_thumb.jpg`).replace(/\\/g, '/');
}

function normalizedKeyFor(tenantId: string, assetId: string): string {
  return join(tenantId, `${assetId}_normalized.mp4`).replace(/\\/g, '/');
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

async function probeSafely(path: string): Promise<VideoMetadata> {
  try {
    return await probeVideo(path, (cmd, args) => execFileAsync(cmd, args, EXEC_OPTS));
  } catch {
    /** ffprobe indisponível ou falhou — segue sem metadados de vídeo. */
    return EMPTY_VIDEO_METADATA;
  }
}

/**
 * Recodifica para MP4/H.264/AAC quando o vídeo enviado não está no formato
 * recomendado (PR 5.16) — melhora a compatibilidade com players/hardware de
 * TV comercial que não decodificam VP9/HEVC/contentores não-MP4. Falha
 * silenciosamente (mantém o ficheiro original) se o `ffmpeg` não conseguir
 * concluir a recodificação.
 */
async function tryNormalizeVideo(
  root: string,
  tenantId: string,
  assetId: string,
  absPath: string,
  metadata: VideoMetadata
): Promise<{ absPath: string; storageKey: string; mimeType: string } | null> {
  const normalizedKey = normalizedKeyFor(tenantId, assetId);
  const normalizedAbsPath = join(root, normalizedKey);
  try {
    await execFileAsync(
      resolveFfmpegPath(),
      buildNormalizeArgs(absPath, normalizedAbsPath),
      NORMALIZE_OPTS
    );
    return { absPath: normalizedAbsPath, storageKey: normalizedKey, mimeType: NORMALIZED_MIME_TYPE };
  } catch {
    void metadata;
    return null;
  }
}

async function processVideo(
  db: QueryClient,
  assetId: string,
  tenantId: string,
  absPath: string,
  mimeType: string
): Promise<void> {
  const root = storageRoot();
  await mkdir(join(root, tenantId), { recursive: true });

  let metadata = await probeSafely(absPath);
  let playbackPath = absPath;
  let newStorageKey: string | null = null;
  let newMimeType: string | null = null;

  if (needsNormalization({ mimeType, videoCodec: metadata.videoCodec, audioCodec: metadata.audioCodec })) {
    const normalized = await tryNormalizeVideo(root, tenantId, assetId, absPath, metadata);
    if (normalized) {
      const normalizedMetadata = await probeSafely(normalized.absPath);
      metadata = normalizedMetadata.videoCodec ? normalizedMetadata : metadata;
      playbackPath = normalized.absPath;
      newStorageKey = normalized.storageKey;
      newMimeType = normalized.mimeType;
      await unlink(absPath).catch(() => {
        /** ficheiro original já pode ter sido removido — ignora. */
      });
    }
  }

  const thumbKey = thumbnailKeyFor(tenantId, assetId);
  let thumbOk = false;
  try {
    await execFileAsync(
      resolveFfmpegPath(),
      buildVideoThumbnailArgs(playbackPath, join(root, thumbKey)),
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
    storageKey: newStorageKey,
    mimeType: newMimeType,
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
    await processVideo(db, asset.id, asset.tenantId, absPath, asset.mimeType);
  }
}
