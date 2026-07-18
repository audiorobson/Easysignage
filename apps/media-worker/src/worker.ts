import { Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import type { Pool } from 'pg';
import {
  ASSET_UPLOADED_JOB,
  MEDIA_QUEUE_NAME,
  type AssetUploadedJobData,
} from '@easysignage/shared-types';
import { processAssetUploaded } from './asset-processor.js';

export function resolveRedisUrl(
  env: Record<string, string | undefined> = process.env
): string {
  return env.REDIS_URL?.trim() || 'redis://localhost:6379';
}

export interface WorkerLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export function createMediaWorker(
  pool: Pool,
  logger: WorkerLogger = console
): Worker<AssetUploadedJobData> {
  const connection = new IORedis(resolveRedisUrl(), { maxRetriesPerRequest: null });
  connection.on('error', (err: Error) => {
    logger.warn(`[media-worker] ligação Redis com erro: ${err.message}`);
  });

  const worker = new Worker<AssetUploadedJobData>(
    MEDIA_QUEUE_NAME,
    async (job) => {
      if (job.name !== ASSET_UPLOADED_JOB) return;
      await processAssetUploaded(pool, job.data);
    },
    { connection }
  );

  worker.on('completed', (job) => {
    logger.info(`[media-worker] job ${job.id} (asset ${job.data.assetId}) concluído`);
  });
  worker.on('failed', (job, err) => {
    logger.error(
      `[media-worker] job ${job?.id ?? '?'} (asset ${job?.data.assetId ?? '?'}) falhou: ${err.message}`
    );
  });
  worker.on('error', (err) => {
    logger.warn(`[media-worker] worker com erro: ${err.message}`);
  });

  return worker;
}
