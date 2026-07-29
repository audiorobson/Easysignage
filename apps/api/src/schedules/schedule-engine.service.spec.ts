import {
  getLocalScheduleContext,
  ScheduleEngineService,
} from './schedule-engine.service';
import { CampaignEngineService } from '../campaigns/campaign-engine.service';
import { DevicesService } from '../devices/devices.service';
import { LicenseService } from '../license/license.service';
import { PrismaService } from '../prisma/prisma.service';
import { VideoWallsService } from '../video-walls/video-walls.service';

describe('getLocalScheduleContext', () => {
  it('maps Monday 09:30 in Europe/Lisbon', () => {
    const d = new Date('2026-04-06T08:30:00.000Z');
    const ctx = getLocalScheduleContext(d, 'Europe/Lisbon');
    expect(ctx.dayOfWeek).toBe(1);
    expect(ctx.minutes).toBe(9 * 60 + 30);
  });
});

describe('ScheduleEngineService.applyForDevice', () => {
  function buildEngine(overrides: {
    rule?: Record<string, unknown> | null;
    state?: Record<string, unknown> | null;
    campaign?: Record<string, unknown> | null;
  } = {}) {
    const prisma = {
      deviceState: {
        findUnique: jest.fn().mockResolvedValue(overrides.state ?? null),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      scheduleRule: {
        findFirst: jest.fn().mockResolvedValue(overrides.rule ?? null),
      },
      deviceGroupMember: { findMany: jest.fn().mockResolvedValue([]) },
      publication: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const devices = {} as DevicesService;
    const videoWalls = {} as VideoWallsService;
    const license = {
      getCurrentTier: jest.fn().mockResolvedValue('ELITE'),
    } as unknown as LicenseService;
    const campaignEngine = {
      findActiveCampaign: jest.fn().mockResolvedValue(overrides.campaign ?? null),
      buildCampaignItem: jest.fn().mockResolvedValue({
        type: 'playlist',
        playlistId: 'pl-promo',
        source: 'campaign',
        campaignId: 'camp-1',
      }),
    } as unknown as CampaignEngineService;
    const engine = new ScheduleEngineService(
      prisma as unknown as PrismaService,
      devices,
      videoWalls,
      license,
      campaignEngine
    );
    return { engine, prisma, campaignEngine };
  }

  it('aplica playlist de campanha activa com prioridade sobre a agenda', async () => {
    const { engine, prisma } = buildEngine({
      campaign: { id: 'camp-1', playlistId: 'pl-promo' },
    });

    const result = await engine.applyForDevice('tenant-1', 'device-1');

    expect(result).toEqual({ applied: true, activeRuleId: null });
    expect(prisma.scheduleRule.findFirst).not.toHaveBeenCalled();
    expect(prisma.deviceState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ activeCampaignId: 'camp-1' }),
      })
    );
  });

  it('aplica regra de agenda com playlist quando não há campanha', async () => {
    const { engine, prisma } = buildEngine({
      rule: {
        id: 'rule-1',
        playlistId: 'pl-rotina',
        layoutId: null,
        videoWallId: null,
      },
    });

    const result = await engine.applyForDevice('tenant-1', 'device-1');

    expect(result).toEqual({ applied: true, activeRuleId: 'rule-1' });
    expect(prisma.deviceState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          activeScheduleRuleId: 'rule-1',
          currentItemJson: expect.objectContaining({
            playlistId: 'pl-rotina',
            source: 'schedule',
          }),
        }),
      })
    );
  });
});
