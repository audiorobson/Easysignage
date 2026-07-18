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
}

/**
 * `thumbnailKey` usa COALESCE: quando o worker não conseguiu gerar uma nova
 * miniatura (ex.: ffmpeg indisponível), preserva a miniatura síncrona já
 * gravada pela API no upload em vez de apagá-la.
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
    ]
  );
}
