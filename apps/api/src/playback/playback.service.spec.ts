import { PlaybackService } from './playback.service';
import { PrismaService } from '../prisma/prisma.service';

function buildPrismaMock() {
  return {
    playbackLog: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

describe('PlaybackService.ingestBatch', () => {
  it('não chama o Prisma quando a lista de eventos está vazia', async () => {
    const prisma = buildPrismaMock();
    const service = new PlaybackService(prisma as unknown as PrismaService);

    const result = await service.ingestBatch('tenant-1', 'device-1', []);

    expect(result).toEqual({ accepted: 0 });
    expect(prisma.playbackLog.createMany).not.toHaveBeenCalled();
  });

  it('grava todos os eventos do lote com tenantId/deviceId injetados', async () => {
    const prisma = buildPrismaMock();
    const service = new PlaybackService(prisma as unknown as PrismaService);

    const result = await service.ingestBatch('tenant-1', 'device-1', [
      { itemType: 'asset', assetId: 'a1', eventType: 'started', startedAt: '2026-07-18T10:00:00.000Z' },
      {
        itemType: 'asset',
        assetId: 'a1',
        eventType: 'completed',
        startedAt: '2026-07-18T10:00:00.000Z',
        durationMs: 8000,
      },
    ]);

    expect(result).toEqual({ accepted: 2 });
    expect(prisma.playbackLog.createMany).toHaveBeenCalledTimes(1);
    const data = prisma.playbackLog.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ tenantId: 'tenant-1', deviceId: 'device-1', itemType: 'asset' });
    expect(data[1].durationMs).toBe(8000);
  });
});

describe('PlaybackService.list', () => {
  it('aplica filtros e paginação, calculando skip a partir da página', async () => {
    const prisma = buildPrismaMock();
    prisma.playbackLog.count.mockResolvedValue(120);
    const service = new PlaybackService(prisma as unknown as PrismaService);

    const page = await service.list('tenant-1', { deviceId: 'device-1', page: 3, pageSize: 20 });

    expect(prisma.playbackLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', deviceId: 'device-1' }),
        skip: 40,
        take: 20,
      })
    );
    expect(page).toEqual(expect.objectContaining({ total: 120, page: 3, pageSize: 20 }));
  });

  it('limita pageSize ao máximo permitido', async () => {
    const prisma = buildPrismaMock();
    const service = new PlaybackService(prisma as unknown as PrismaService);

    await service.list('tenant-1', { pageSize: 999999 });

    expect(prisma.playbackLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 })
    );
  });
});

describe('PlaybackService.toCsv', () => {
  it('gera CSV com cabeçalho e escapa campos com vírgula/aspas', () => {
    const service = new PlaybackService({} as unknown as PrismaService);
    const csv = service.toCsv([
      {
        id: 'log-1',
        deviceId: 'device-1',
        deviceName: 'Totem, Entrada',
        itemType: 'asset',
        assetId: 'a1',
        assetName: 'Banner "Promo"',
        playlistId: null,
        playlistName: null,
        eventType: 'completed',
        startedAt: '2026-07-18T10:00:00.000Z',
        durationMs: 8000,
        errorMessage: null,
        createdAt: '2026-07-18T10:00:08.000Z',
      },
    ]);

    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'id,deviceName,itemType,assetName,playlistName,eventType,startedAt,durationMs,errorMessage'
    );
    expect(lines[1]).toContain('"Totem, Entrada"');
    expect(lines[1]).toContain('"Banner ""Promo"""');
  });
});
