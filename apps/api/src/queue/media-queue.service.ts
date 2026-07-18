import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  ASSET_UPLOADED_JOB,
  MEDIA_QUEUE_NAME,
  type AssetUploadedJobData,
} from '@easysignage/shared-types';

export function resolveRedisUrl(
  env: Record<string, string | undefined> = process.env
): string {
  return env.REDIS_URL?.trim() || 'redis://localhost:6379';
}

/**
 * Publica jobs de mídia (fila `media`, Fase 5.D). O consumidor (`apps/media-worker`)
 * é introduzido no PR 5.15 — até lá, ninguém consome a fila, mas publicar já é
 * seguro (BullMQ mantém os jobs no Redis).
 *
 * Best-effort por desenho: uma instalação self-hosted pequena pode não ter Redis
 * configurado — nesse caso a publicação falha silenciosamente (log de aviso) e o
 * pipeline síncrono existente em `AssetsService` (thumbnail via sharp/ffmpeg no
 * próprio request) continua a ser o fallback.
 */
@Injectable()
export class MediaQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(MediaQueueService.name);
  private readonly connection: IORedis;
  private readonly queue: Queue<AssetUploadedJobData>;

  constructor() {
    this.connection = new IORedis(resolveRedisUrl(), {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    // Sem listener, um erro de conexão (Redis indisponível) derrubaria o processo
    // Node inteiro (EventEmitter sem handler para 'error').
    this.connection.on('error', (err) => {
      this.logger.warn(`Ligação Redis com erro: ${err.message}`);
    });
    this.queue = new Queue<AssetUploadedJobData>(MEDIA_QUEUE_NAME, {
      connection: this.connection,
    });
    // BullMQ propaga o 'error' da ligação Redis para a própria fila; sem um
    // listener aqui, um Redis indisponível gera um "Unhandled error" ruidoso.
    this.queue.on('error', (err) => {
      this.logger.warn(`Fila '${MEDIA_QUEUE_NAME}' com erro de ligação: ${err.message}`);
    });
  }

  async publishAssetUploaded(data: AssetUploadedJobData): Promise<void> {
    try {
      await this.queue.add(ASSET_UPLOADED_JOB, data, {
        removeOnComplete: 500,
        removeOnFail: 500,
      });
    } catch (e) {
      this.logger.warn(
        `Falha ao publicar job ${ASSET_UPLOADED_JOB} (Redis indisponível?): ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close().catch(() => {});
    this.connection.disconnect();
  }
}
