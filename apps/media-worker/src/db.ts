import { Pool } from 'pg';

export function createPool(databaseUrl: string | undefined = process.env.DATABASE_URL): Pool {
  if (!databaseUrl?.trim()) {
    throw new Error('DATABASE_URL não definido — necessário para o media-worker');
  }
  return new Pool({ connectionString: databaseUrl });
}

export interface AssetRow {
  id: string;
  tenantId: string;
  kind: string;
  mimeType: string;
  storageKey: string | null;
}

/** Cliente mínimo de query — evita acoplar o worker ao Prisma Client gerado em `apps/api`. */
export interface QueryClient {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

export async function getAssetForProcessing(
  db: QueryClient,
  assetId: string
): Promise<AssetRow | null> {
  const { rows } = await db.query(
    `SELECT id, tenant_id AS "tenantId", kind, mime_type AS "mimeType", storage_key AS "storageKey"
     FROM assets WHERE id = $1`,
    [assetId]
  );
  return (rows[0] as AssetRow | undefined) ?? null;
}

export interface AssetProcessingResult {
  thumbnailKey?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
  /** Definidos apenas quando o vídeo foi normalizado (PR 5.16) — novo ficheiro MP4. */
  storageKey?: string | null;
  mimeType?: string | null;
}

/**
 * `thumbnailKey`/`storageKey`/`mimeType` usam COALESCE: quando o worker não
 * gerou um novo valor (ex.: ffmpeg indisponível, ou vídeo já no formato
 * recomendado), preserva o valor síncrono já gravado pela API no upload em
 * vez de apagá-lo.
 */
export async function updateAssetMetadata(
  db: QueryClient,
  assetId: string,
  result: AssetProcessingResult
): Promise<void> {
  await db.query(
    `UPDATE assets SET
       thumbnail_key = COALESCE($2, thumbnail_key),
       width_px = $3,
       height_px = $4,
       duration_ms = $5,
       video_codec = $6,
       audio_codec = $7,
       storage_key = COALESCE($8, storage_key),
       mime_type = COALESCE($9, mime_type),
       processed_at = now()
     WHERE id = $1`,
    [
      assetId,
      result.thumbnailKey ?? null,
      result.width ?? null,
      result.height ?? null,
      result.durationMs ?? null,
      result.videoCodec ?? null,
      result.audioCodec ?? null,
      result.storageKey ?? null,
      result.mimeType ?? null,
    ]
  );
}
