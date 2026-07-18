import { AlertsService } from './alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import { LicenseService } from '../license/license.service';

function buildPrismaMock() {
  return {
    device: { findFirst: jest.fn(), findMany: jest.fn() },
    alert: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };
}

function buildLicenseMock(tier: 'TRIAL' | 'LITE' | 'STD' | 'ELITE' = 'ELITE') {
  return { getCurrentTier: jest.fn().mockResolvedValue(tier) } as unknown as LicenseService;
}

const DEVICE_ROW_BASE = {
  id: 'device-1',
  name: 'Totem Entrada',
  lastSeenAt: new Date(),
  state: {
    telemetrySnapshotJson: null,
    appliedPublicationVersion: null,
    appliedContentRevision: null,
    appliedAt: null,
    lastSyncAt: null,
    currentPublication: null,
  },
};

describe('AlertsService.evaluateDevice', () => {
  it('não avalia quando o tier não tem a feature "alerts" (Lite)', async () => {
    const prisma = buildPrismaMock();
    const service = new AlertsService(prisma as unknown as PrismaService, buildLicenseMock('LITE'));

    const result = await service.evaluateDevice('tenant-1', 'device-1');

    expect(result).toEqual({ evaluated: false, skipped: true });
    expect(prisma.device.findFirst).not.toHaveBeenCalled();
  });

  it('abre alerta device_offline quando sem heartbeat há mais de 5 minutos', async () => {
    const prisma = buildPrismaMock();
    prisma.device.findFirst.mockResolvedValue({
      ...DEVICE_ROW_BASE,
      lastSeenAt: new Date(Date.now() - 10 * 60 * 1000),
    });
    prisma.alert.findUnique.mockResolvedValue(null);
    const service = new AlertsService(prisma as unknown as PrismaService, buildLicenseMock('STD'));

    await service.evaluateDevice('tenant-1', 'device-1');

    expect(prisma.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ alertType: 'device_offline', severity: 'warning' }),
      })
    );
  });

  it('abre alerta device_offline_long e resolve device_offline após 24h sem heartbeat', async () => {
    const prisma = buildPrismaMock();
    prisma.device.findFirst.mockResolvedValue({
      ...DEVICE_ROW_BASE,
      lastSeenAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });
    prisma.alert.findUnique.mockResolvedValue(null);
    const service = new AlertsService(prisma as unknown as PrismaService, buildLicenseMock('STD'));

    await service.evaluateDevice('tenant-1', 'device-1');

    expect(prisma.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ alertType: 'device_offline_long', severity: 'critical' }),
      })
    );
    expect(prisma.alert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ alertType: 'device_offline' }),
      })
    );
  });

  it('resolve alertas de offline quando o device está online e sem falhas', async () => {
    const prisma = buildPrismaMock();
    prisma.device.findFirst.mockResolvedValue({ ...DEVICE_ROW_BASE, lastSeenAt: new Date() });
    const service = new AlertsService(prisma as unknown as PrismaService, buildLicenseMock('STD'));

    await service.evaluateDevice('tenant-1', 'device-1');

    const resolvedTypes = prisma.alert.updateMany.mock.calls.map(
      (call: any[]) => call[0].where.alertType
    );
    expect(resolvedTypes).toEqual(
      expect.arrayContaining(['device_offline', 'device_offline_long'])
    );
    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  it('abre alerta playback_fault quando a telemetria reporta erro', async () => {
    const prisma = buildPrismaMock();
    prisma.device.findFirst.mockResolvedValue({
      ...DEVICE_ROW_BASE,
      state: {
        ...DEVICE_ROW_BASE.state,
        telemetrySnapshotJson: { connected: false },
      },
    });
    prisma.alert.findUnique.mockResolvedValue(null);
    const service = new AlertsService(prisma as unknown as PrismaService, buildLicenseMock('STD'));

    await service.evaluateDevice('tenant-1', 'device-1');

    expect(prisma.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ alertType: 'playback_fault' }),
      })
    );
  });

  it('reabre um alerta previamente resolvido em vez de duplicar', async () => {
    const prisma = buildPrismaMock();
    prisma.device.findFirst.mockResolvedValue({
      ...DEVICE_ROW_BASE,
      lastSeenAt: new Date(Date.now() - 10 * 60 * 1000),
    });
    prisma.alert.findUnique.mockResolvedValue({
      id: 'alert-1',
      status: 'resolved',
    });
    const service = new AlertsService(prisma as unknown as PrismaService, buildLicenseMock('STD'));

    await service.evaluateDevice('tenant-1', 'device-1');

    expect(prisma.alert.create).not.toHaveBeenCalled();
    expect(prisma.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alert-1' },
        data: expect.objectContaining({ status: 'open' }),
      })
    );
  });
});

describe('AlertsService.summary', () => {
  it('agrega contagens open/acknowledged/critical', async () => {
    const prisma = buildPrismaMock();
    prisma.alert.count
      .mockResolvedValueOnce(3) // open
      .mockResolvedValueOnce(1) // acknowledged
      .mockResolvedValueOnce(2); // critical
    const service = new AlertsService(prisma as unknown as PrismaService, buildLicenseMock('STD'));

    const summary = await service.summary('tenant-1');

    expect(summary).toEqual({ open: 3, acknowledged: 1, critical: 2, active: 4 });
  });
});
