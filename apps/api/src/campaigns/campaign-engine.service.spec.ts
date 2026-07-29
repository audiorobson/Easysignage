import { CampaignEngineService } from './campaign-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { LicenseService } from '../license/license.service';

type MockPrisma = {
  device: { findFirst: jest.Mock };
  deviceGroupMember: { findMany: jest.Mock };
  campaign: { findMany: jest.Mock };
};

function buildPrismaMock(): MockPrisma {
  return {
    device: { findFirst: jest.fn() },
    deviceGroupMember: { findMany: jest.fn() },
    campaign: { findMany: jest.fn() },
  };
}

function buildLicenseMock(tier: 'TRIAL' | 'LITE' | 'STD' | 'ELITE') {
  return { getCurrentTier: jest.fn().mockResolvedValue(tier) } as unknown as LicenseService;
}

function buildService(prisma: MockPrisma | PrismaService, tier: 'TRIAL' | 'LITE' | 'STD' | 'ELITE') {
  return new CampaignEngineService(
    prisma as unknown as PrismaService,
    buildLicenseMock(tier),
    {} as never,
    {} as never
  );
}

describe('CampaignEngineService.findActiveCampaign', () => {
  const tenantId = 'tenant-1';
  const deviceId = 'device-1';

  it('retorna null quando o tier não tem a feature "campaigns" (Lite)', async () => {
    const prisma = buildPrismaMock();
    const service = buildService(prisma, 'LITE');

    const result = await service.findActiveCampaign(tenantId, deviceId);

    expect(result).toBeNull();
    expect(prisma.device.findFirst).not.toHaveBeenCalled();
  });

  it('escolhe a campanha de maior prioridade entre candidatas ativas', async () => {
    const prisma = buildPrismaMock();
    prisma.device.findFirst.mockResolvedValue({ siteId: 'site-1' });
    prisma.deviceGroupMember.findMany.mockResolvedValue([]);
    prisma.campaign.findMany.mockResolvedValue([
      {
        id: 'high-priority',
        playlistId: 'pl-high',
        layoutId: null,
        videoWallId: null,
        priority: 20,
        startAt: null,
        endAt: null,
        dayOfWeek: null,
        startMin: null,
        endMin: null,
      },
      {
        id: 'low-priority',
        playlistId: 'pl-low',
        layoutId: null,
        videoWallId: null,
        priority: 5,
        startAt: null,
        endAt: null,
        dayOfWeek: null,
        startMin: null,
        endMin: null,
      },
    ]);
    const service = buildService(prisma, 'STD');

    const result = await service.findActiveCampaign(tenantId, deviceId);

    expect(result?.id).toBe('high-priority');
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }] })
    );
  });

  it('ignora campanha fora da janela horária e cai para a próxima candidata', async () => {
    const prisma = buildPrismaMock();
    prisma.device.findFirst.mockResolvedValue({ siteId: 'site-1' });
    prisma.deviceGroupMember.findMany.mockResolvedValue([]);
    prisma.campaign.findMany.mockResolvedValue([
      {
        id: 'window-not-matching',
        playlistId: 'pl-a',
        layoutId: null,
        videoWallId: null,
        priority: 20,
        startAt: null,
        endAt: null,
        dayOfWeek: 1,
        startMin: 0,
        endMin: 60,
      },
      {
        id: 'always-on',
        playlistId: 'pl-b',
        layoutId: null,
        videoWallId: null,
        priority: 5,
        startAt: null,
        endAt: null,
        dayOfWeek: null,
        startMin: null,
        endMin: null,
      },
    ]);
    const service = buildService(prisma, 'ELITE');

    // Terça-feira (dayOfWeek=2) às 10:00 UTC — não corresponde à janela de segunda 00:00-01:00.
    const now = new Date('2026-07-21T10:00:00.000Z');
    const result = await service.findActiveCampaign(tenantId, deviceId, now);

    expect(result?.id).toBe('always-on');
  });

  it('respeita o intervalo de datas (startAt/endAt)', async () => {
    const prisma = buildPrismaMock();
    prisma.device.findFirst.mockResolvedValue({ siteId: 'site-1' });
    prisma.deviceGroupMember.findMany.mockResolvedValue([]);
    prisma.campaign.findMany.mockResolvedValue([
      {
        id: 'expired',
        playlistId: 'pl-a',
        layoutId: null,
        videoWallId: null,
        priority: 20,
        startAt: new Date('2020-01-01T00:00:00.000Z'),
        endAt: new Date('2020-12-31T00:00:00.000Z'),
        dayOfWeek: null,
        startMin: null,
        endMin: null,
      },
    ]);
    const service = buildService(prisma, 'STD');

    const result = await service.findActiveCampaign(tenantId, deviceId, new Date('2026-07-21T10:00:00.000Z'));

    expect(result).toBeNull();
  });
});

describe('CampaignEngineService.buildCampaignItem', () => {
  it('gera o payload de current_item_json com source=campaign', async () => {
    const service = buildService({} as PrismaService, 'STD');
    const item = await service.buildCampaignItem('tenant-1', 'device-1', {
      id: 'c1',
      playlistId: 'pl-1',
      layoutId: null,
      videoWallId: null,
      priority: 10,
    });
    expect(item).toEqual({
      type: 'playlist',
      playlistId: 'pl-1',
      source: 'campaign',
      campaignId: 'c1',
    });
  });
});

describe('CampaignEngineService.resolveDeviceIdsForScope', () => {
  const tenantId = 'tenant-1';

  it('scope device retorna apenas o device informado', async () => {
    const service = buildService({} as PrismaService, 'STD');
    const ids = await service.resolveDeviceIdsForScope(tenantId, 'device', 'device-9');
    expect(ids).toEqual(['device-9']);
  });

  it('scope group resolve membros do grupo', async () => {
    const prisma = buildPrismaMock();
    prisma.deviceGroupMember.findMany.mockResolvedValue([
      { deviceId: 'd1' },
      { deviceId: 'd2' },
    ]);
    const service = buildService(prisma, 'STD');
    const ids = await service.resolveDeviceIdsForScope(tenantId, 'group', null, 'group-1');
    expect(ids).toEqual(['d1', 'd2']);
  });

  it('scope desconhecido retorna lista vazia', async () => {
    const service = buildService({} as PrismaService, 'STD');
    const ids = await service.resolveDeviceIdsForScope(tenantId, 'unknown');
    expect(ids).toEqual([]);
  });
});
