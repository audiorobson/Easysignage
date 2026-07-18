import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ASSET_UPLOADED_JOB, MEDIA_QUEUE_NAME } from '@easysignage/shared-types';
import { MediaQueueService, resolveRedisUrl } from './media-queue.service';

/**
 * Integração com Redis efémero (PR 5.14). Em CI, `.github/workflows/ci.yml`
 * sobe um serviço `redis:7` em `localhost:6379` (ver `REDIS_URL`). Localmente,
 * requer um Redis acessível em `REDIS_URL`/`localhost:6379` — se indisponível,
 * o teste é ignorado em runtime (o próprio serviço já degrada com segurança
 * nesse cenário, o que é verificado no teste de fallback abaixo).
 *
 * Nota: a verificação usa `Queue#getJob` em vez de um `Worker` real — um Worker
 * BullMQ mantém ligações Redis em modo bloqueante (BRPOPLPUSH) cujo encerramento
 * limpo é mais lento/instável em ambiente de teste; como ainda não há consumidor
 * (o `apps/media-worker`, Fase 5.D, PR 5.15+), inspecionar o job na fila é
 * suficiente para validar a publicação ponta-a-ponta com Redis real.
 */
describe('MediaQueueService (integração Redis)', () => {
  let redisAvailable = false;

  beforeAll(async () => {
    const probe = new IORedis(resolveRedisUrl(), { lazyConnect: true });
    probe.on('error', () => {
      /* apenas para não derrubar o processo com erro não tratado */
    });
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        probe.connect().then(() => probe.ping()),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), 5_000);
        }),
      ]);
      redisAvailable = true;
    } catch {
      redisAvailable = false;
    } finally {
      if (timer) clearTimeout(timer);
      probe.disconnect();
    }
  }, 15_000);

  it('publica um job asset.uploaded que fica disponível na fila (Redis real)', async () => {
    if (!redisAvailable) {
      // Redis não acessível neste ambiente (ex.: dev local sem serviço configurado).
      // Em CI, `.github/workflows/ci.yml` garante um Redis efémero — ver `REDIS_URL`.
      console.warn('Redis indisponível — teste de integração ignorado.');
      return;
    }
    const service = new MediaQueueService();
    const inspectConnection = new IORedis(resolveRedisUrl(), {
      maxRetriesPerRequest: null,
    });
    const inspectQueue = new Queue(MEDIA_QUEUE_NAME, {
      connection: inspectConnection,
    });

    try {
      await service.publishAssetUploaded({
        tenantId: 'tenant-1',
        assetId: 'asset-1',
        kind: 'image',
      });

      const jobs = await inspectQueue.getJobs(['waiting', 'delayed'], 0, 10);
      const job = jobs.find((j) => j.data.assetId === 'asset-1');
      expect(job).toBeDefined();
      expect(job?.name).toBe(ASSET_UPLOADED_JOB);
      expect(job?.data).toEqual({
        tenantId: 'tenant-1',
        assetId: 'asset-1',
        kind: 'image',
      });

      await job?.remove();
    } finally {
      await inspectQueue.close();
      inspectConnection.disconnect();
      await service.onModuleDestroy();
    }
  }, 20_000);

  it('não lança quando o Redis está indisponível (fallback best-effort)', async () => {
    const service = new MediaQueueService();
    // Força uma ligação para um endereço que não responde, simulando Redis fora do ar.
    (service as unknown as { connection: IORedis }).connection.disconnect();

    await expect(
      service.publishAssetUploaded({
        tenantId: 't',
        assetId: 'a',
        kind: 'image',
      })
    ).resolves.toBeUndefined();

    await service.onModuleDestroy();
  });

  it('resolveRedisUrl usa REDIS_URL do ambiente ou o valor por omissão', () => {
    expect(resolveRedisUrl({ REDIS_URL: 'redis://custom:1234' })).toBe(
      'redis://custom:1234'
    );
    expect(resolveRedisUrl({})).toBe('redis://localhost:6379');
    expect(resolveRedisUrl({ REDIS_URL: '  ' })).toBe('redis://localhost:6379');
  });

  it('usa a constante ASSET_UPLOADED_JOB partilhada', () => {
    expect(ASSET_UPLOADED_JOB).toBe('asset.uploaded');
  });
});
