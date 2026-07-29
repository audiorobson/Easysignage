import { Injectable, Logger } from '@nestjs/common';
import IORedis from 'ioredis';
import { resolveRedisUrl } from '../queue/media-queue.service';

export interface PendingSsoState {
  tenantId: string;
  nonce: string;
  createdAt: number;
}

const KEY_PREFIX = 'easysignage:sso:state:';
const TTL_SEC = 600;

@Injectable()
export class SsoStateStore {
  private readonly logger = new Logger(SsoStateStore.name);
  private readonly memory = new Map<string, PendingSsoState>();
  private readonly redis: IORedis | null;
  /** null = ainda não tentou; true/false = resultado do ping inicial */
  private redisReady: boolean | null = null;

  constructor() {
    try {
      const client = new IORedis(resolveRedisUrl(), {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      client.on('error', () => {
        /* evita unhandled; ensureRedis regista aviso */
      });
      this.redis = client;
    } catch {
      this.redis = null;
    }
  }

  private async ensureRedis(): Promise<IORedis | null> {
    if (!this.redis) return null;
    if (this.redisReady === false) return null;
    if (this.redisReady === true) return this.redis;
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }
      await this.redis.ping();
      this.redisReady = true;
      return this.redis;
    } catch (err) {
      this.redisReady = false;
      this.logger.warn(
        `Redis indisponível para state SSO — a usar memória local: ${err instanceof Error ? err.message : err}`
      );
      return null;
    }
  }

  async save(state: string, value: PendingSsoState): Promise<void> {
    this.memory.set(state, value);
    const redis = await this.ensureRedis();
    if (!redis) return;
    try {
      await redis.set(`${KEY_PREFIX}${state}`, JSON.stringify(value), 'EX', TTL_SEC);
    } catch (err) {
      this.logger.warn(
        `Falha ao gravar state SSO no Redis (fallback em memória): ${err instanceof Error ? err.message : err}`
      );
    }
  }

  async consume(state: string): Promise<PendingSsoState | null> {
    let pending = this.memory.get(state) ?? null;
    const redis = await this.ensureRedis();
    if (redis) {
      try {
        const raw = await redis.get(`${KEY_PREFIX}${state}`);
        if (raw) {
          pending = JSON.parse(raw) as PendingSsoState;
        }
        await redis.del(`${KEY_PREFIX}${state}`);
      } catch (err) {
        this.logger.warn(
          `Falha ao ler state SSO no Redis: ${err instanceof Error ? err.message : err}`
        );
      }
    }
    this.memory.delete(state);
    return pending;
  }

  pruneExpired(now = Date.now(), ttlMs = TTL_SEC * 1000): void {
    for (const [key, value] of this.memory) {
      if (now - value.createdAt > ttlMs) {
        this.memory.delete(key);
      }
    }
  }
}
