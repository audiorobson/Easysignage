import { TelemetryService } from './telemetry.service';
import { PrismaService } from '../prisma/prisma.service';
import { WolService } from './wol.service';

function buildPrismaMock() {
  return {
    device: { count: jest.fn().mockResolvedValue(0) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
}

describe('TelemetryService.uptimeHistory', () => {
  it('retorna 0% em todos os dias quando o tenant não tem devices (sem consultar heartbeats)', async () => {
    const prisma = buildPrismaMock();
    const service = new TelemetryService(prisma as unknown as PrismaService, {} as WolService);

    const points = await service.uptimeHistory('tenant-1', 3);

    expect(points).toHaveLength(3);
    expect(points.every((p) => p.onlinePct === 0)).toBe(true);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('calcula onlinePct por dia a partir de devices distintos com heartbeat', async () => {
    const prisma = buildPrismaMock();
    prisma.device.count.mockResolvedValue(4);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    prisma.$queryRaw.mockResolvedValue([
      { day: yesterday, deviceCount: 2n },
      { day: today, deviceCount: 4n },
    ]);

    const service = new TelemetryService(prisma as unknown as PrismaService, {} as WolService);
    const points = await service.uptimeHistory('tenant-1', 2);

    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ onlinePct: 50 });
    expect(points[1]).toMatchObject({ onlinePct: 100 });
  });

  it('preenche 0% para dias sem heartbeat algum', async () => {
    const prisma = buildPrismaMock();
    prisma.device.count.mockResolvedValue(3);
    prisma.$queryRaw.mockResolvedValue([]);

    const service = new TelemetryService(prisma as unknown as PrismaService, {} as WolService);
    const points = await service.uptimeHistory('tenant-1', 5);

    expect(points).toHaveLength(5);
    expect(points.every((p) => p.onlinePct === 0)).toBe(true);
  });

  it('nunca ultrapassa 100%, mesmo com mais devices distintos do que devices ativos', async () => {
    const prisma = buildPrismaMock();
    prisma.device.count.mockResolvedValue(2);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    prisma.$queryRaw.mockResolvedValue([{ day: today, deviceCount: 5n }]);

    const service = new TelemetryService(prisma as unknown as PrismaService, {} as WolService);
    const points = await service.uptimeHistory('tenant-1', 1);

    expect(points[0].onlinePct).toBe(100);
  });

  it('limita days ao intervalo [1, 90]', async () => {
    const prisma = buildPrismaMock();
    const service = new TelemetryService(prisma as unknown as PrismaService, {} as WolService);

    expect(await service.uptimeHistory('tenant-1', 0)).toHaveLength(24);
    expect(await service.uptimeHistory('tenant-1', 500)).toHaveLength(90);
  });
});
