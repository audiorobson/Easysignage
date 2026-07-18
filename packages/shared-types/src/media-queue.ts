/**
 * PR 5.14 — fila Redis/BullMQ para jobs de mídia. Nomes/tipos partilhados
 * entre o produtor (API, ao terminar um upload) e o consumidor
 * (`apps/media-worker`, Fase 5.D, PR 5.15+).
 */

export const MEDIA_QUEUE_NAME = 'media';

export const ASSET_UPLOADED_JOB = 'asset.uploaded';

export interface AssetUploadedJobData {
  tenantId: string;
  assetId: string;
  /** `image` | `video` — o worker decide o pipeline (thumbnail/metadata/transcode). */
  kind: string;
}
