import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Prisma } from '../generated/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { CAMPAIGN_CONTENT_SOURCE } from '@easysignage/shared-types';
import { DevicesService } from '../devices/devices.service';
import { VideoWallsService } from '../video-walls/video-walls.service';
import { CampaignEngineService } from '../campaigns/campaign-engine.service';
import { LicenseService } from '../license/license.service';
import { tierHasFeature } from '@easysignage/license-core';

export const SCHEDULE_CONTENT_SOURCE = 'schedule';

function isScheduleItem(item: unknown): boolean {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  return (item as Record<string, unknown>).source === SCHEDULE_CONTENT_SOURCE;
}

function isCampaignItem(item: unknown): boolean {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  return (item as Record<string, unknown>).source === CAMPAIGN_CONTENT_SOURCE;
}

function isTimedOverrideItem(item: unknown): boolean {
  return isScheduleItem(item) || isCampaignItem(item);
}

function itemsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 1 = segunda … 7 = domingo (ISO), alinhado ao CMS. */
export function getLocalScheduleContext(
  now: Date,
  timeZone: string
): { dayOfWeek: number; minutes: number } {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(now);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const dayOfWeek = map[weekday] ?? 1;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { dayOfWeek, minutes: hour * 60 + minute };
}

@Injectable()
export class ScheduleEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devices: DevicesService,
    private readonly videoWalls: VideoWallsService,
    private readonly license: LicenseService,
    @Inject(forwardRef(() => CampaignEngineService))
    private readonly campaignEngine: CampaignEngineService
  ) {}

  private timeZone(): string {
    return process.env.SCHEDULE_TIMEZONE?.trim() || 'Europe/Lisbon';
  }

  async findActiveRule(
    tenantId: string,
    deviceId: string,
    now = new Date()
  ) {
    const { dayOfWeek, minutes } = getLocalScheduleContext(now, this.timeZone());

    const memberships = await this.prisma.deviceGroupMember.findMany({
      where: { deviceId },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);

    return this.prisma.scheduleRule.findFirst({
      where: {
        tenantId,
        enabled: true,
        dayOfWeek,
        startMin: { lte: minutes },
        endMin: { gt: minutes },
        OR: [
          { scope: 'device', deviceId },
          ...(groupIds.length
            ? [{ scope: 'group', groupId: { in: groupIds } }]
            : []),
        ],
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  private async buildScheduledItem(
    tenantId: string,
    deviceId: string,
    rule: {
      id: string;
      playlistId: string | null;
      layoutId: string | null;
      videoWallId: string | null;
    }
  ): Promise<Record<string, unknown> | null> {
    try {
      if (rule.playlistId) {
        return {
          type: 'playlist',
          playlistId: rule.playlistId,
          source: SCHEDULE_CONTENT_SOURCE,
          scheduleRuleId: rule.id,
        };
      }
      if (rule.layoutId) {
        const layout = await this.devices.buildLayoutCurrentItem(
          tenantId,
          rule.layoutId
        );
        const layoutDeviceId = await this.prisma.deviceLayout.findFirst({
          where: { id: rule.layoutId, tenantId },
          select: { deviceId: true },
        });
        if (layoutDeviceId?.deviceId !== deviceId) return null;
        return {
          ...layout,
          source: SCHEDULE_CONTENT_SOURCE,
          scheduleRuleId: rule.id,
        };
      }
      if (rule.videoWallId) {
        const tier = await this.license.getCurrentTier();
        if (!tierHasFeature(tier, 'video_walls')) {
          return null;
        }
        const tile = await this.prisma.videoWallTile.findFirst({
          where: { wallId: rule.videoWallId, deviceId },
        });
        if (!tile) return null;
        const wallItem = await this.videoWalls.buildTileCurrentItem(
          tenantId,
          rule.videoWallId,
          deviceId
        );
        return {
          ...wallItem,
          source: SCHEDULE_CONTENT_SOURCE,
          scheduleRuleId: rule.id,
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  private async resolveFallbackItem(
    tenantId: string,
    deviceId: string,
    state: {
      scheduleBaselineItemJson: unknown;
      currentPublicationId: string | null;
      currentItemJson: unknown;
    } | null
  ): Promise<Prisma.InputJsonValue | null> {
    if (state?.scheduleBaselineItemJson != null) {
      return state.scheduleBaselineItemJson as Prisma.InputJsonValue;
    }
    if (state?.currentPublicationId) {
      const pub = await this.prisma.publication.findFirst({
        where: { id: state.currentPublicationId, tenantId, deviceId },
        select: { payloadJson: true },
      });
      if (pub?.payloadJson != null) {
        return pub.payloadJson as Prisma.InputJsonValue;
      }
    }
    if (state?.currentItemJson != null && !isTimedOverrideItem(state.currentItemJson)) {
      return state.currentItemJson as Prisma.InputJsonValue;
    }
    return null;
  }

  private async applyActiveCampaign(
    tenantId: string,
    deviceId: string,
    now: Date,
    state: {
      scheduleBaselineItemJson: unknown;
      currentPublicationId: string | null;
      currentItemJson: unknown;
      activeCampaignId: string | null;
      activeScheduleRuleId: string | null;
    } | null
  ): Promise<{ applied: boolean; activeCampaignId: string | null } | null> {
    const campaign = await this.campaignEngine.findActiveCampaign(
      tenantId,
      deviceId,
      now
    );
    const nowDate = new Date();

    if (campaign) {
      const scheduledItem = this.campaignEngine.buildCampaignItem(campaign);
      const itemJson = scheduledItem as Prisma.InputJsonValue;
      const alreadyActive =
        state?.activeCampaignId === campaign.id &&
        itemsEqual(state.currentItemJson, scheduledItem);

      if (alreadyActive) {
        return { applied: false, activeCampaignId: campaign.id };
      }

      let baseline: Prisma.InputJsonValue | undefined =
        state?.scheduleBaselineItemJson != null
          ? (state.scheduleBaselineItemJson as Prisma.InputJsonValue)
          : undefined;
      if (baseline == null && state?.currentItemJson != null) {
        if (!isTimedOverrideItem(state.currentItemJson)) {
          baseline = state.currentItemJson as Prisma.InputJsonValue;
        } else {
          const fb = await this.resolveFallbackItem(tenantId, deviceId, state);
          baseline = fb ?? undefined;
        }
      }

      await this.prisma.deviceState.upsert({
        where: { deviceId },
        create: {
          deviceId,
          tenantId,
          currentItemJson: itemJson,
          scheduleBaselineItemJson: baseline,
          activeCampaignId: campaign.id,
          activeScheduleRuleId: null,
          lastSyncAt: nowDate,
        },
        update: {
          currentItemJson: itemJson,
          ...(baseline != null ? { scheduleBaselineItemJson: baseline } : {}),
          activeCampaignId: campaign.id,
          activeScheduleRuleId: null,
          lastSyncAt: nowDate,
        },
      });

      return { applied: true, activeCampaignId: campaign.id };
    }

    if (!state?.activeCampaignId) return null;

    const fallback = await this.resolveFallbackItem(tenantId, deviceId, state);
    await this.prisma.deviceState.update({
      where: { deviceId },
      data: {
        currentItemJson:
          fallback === null || fallback === undefined
            ? Prisma.JsonNull
            : fallback,
        activeCampaignId: null,
        lastSyncAt: nowDate,
      },
    });

    return { applied: true, activeCampaignId: null };
  }

  async applyForDevice(
    tenantId: string,
    deviceId: string,
    now = new Date()
  ): Promise<{ applied: boolean; activeRuleId: string | null }> {
    const state = await this.prisma.deviceState.findUnique({
      where: { deviceId },
    });

    const campaignResult = await this.applyActiveCampaign(
      tenantId,
      deviceId,
      now,
      state
    );
    if (campaignResult?.activeCampaignId) {
      return {
        applied: campaignResult.applied,
        activeRuleId: null,
      };
    }

    let currentState = state;
    if (campaignResult?.applied) {
      currentState = await this.prisma.deviceState.findUnique({
        where: { deviceId },
      });
    }

    const rule = await this.findActiveRule(tenantId, deviceId, now);

    const nowDate = new Date();

    if (rule) {
      const scheduledItem = await this.buildScheduledItem(
        tenantId,
        deviceId,
        rule
      );

      if (!scheduledItem) {
        if (!currentState?.activeScheduleRuleId) {
          return { applied: false, activeRuleId: null };
        }
        const fallback = await this.resolveFallbackItem(
          tenantId,
          deviceId,
          currentState
        );
        await this.prisma.deviceState.update({
          where: { deviceId },
          data: {
            currentItemJson:
              fallback === null || fallback === undefined
                ? Prisma.JsonNull
                : fallback,
            activeScheduleRuleId: null,
            lastSyncAt: nowDate,
          },
        });
        return { applied: true, activeRuleId: null };
      }

      const itemJson = scheduledItem as Prisma.InputJsonValue;
      const alreadyActive =
        currentState?.activeScheduleRuleId === rule.id &&
        itemsEqual(currentState.currentItemJson, scheduledItem);

      if (alreadyActive) {
        return { applied: false, activeRuleId: rule.id };
      }

      let baseline: Prisma.InputJsonValue | undefined =
        currentState?.scheduleBaselineItemJson != null
          ? (currentState.scheduleBaselineItemJson as Prisma.InputJsonValue)
          : undefined;
      if (baseline == null && currentState?.currentItemJson != null) {
        if (!isTimedOverrideItem(currentState.currentItemJson)) {
          baseline = currentState.currentItemJson as Prisma.InputJsonValue;
        } else {
          const fb = await this.resolveFallbackItem(
            tenantId,
            deviceId,
            currentState
          );
          baseline = fb ?? undefined;
        }
      }

      await this.prisma.deviceState.upsert({
        where: { deviceId },
        create: {
          deviceId,
          tenantId,
          currentItemJson: itemJson,
          scheduleBaselineItemJson: baseline,
          activeScheduleRuleId: rule.id,
          lastSyncAt: nowDate,
        },
        update: {
          currentItemJson: itemJson,
          ...(baseline != null ? { scheduleBaselineItemJson: baseline } : {}),
          activeScheduleRuleId: rule.id,
          lastSyncAt: nowDate,
        },
      });

      return { applied: true, activeRuleId: rule.id };
    }

    if (!currentState?.activeScheduleRuleId) {
      return { applied: false, activeRuleId: null };
    }

    const fallback = await this.resolveFallbackItem(
      tenantId,
      deviceId,
      currentState
    );

    await this.prisma.deviceState.update({
      where: { deviceId },
      data: {
        currentItemJson:
          fallback === null || fallback === undefined
            ? Prisma.JsonNull
            : fallback,
        activeScheduleRuleId: null,
        lastSyncAt: nowDate,
      },
    });

    return { applied: true, activeRuleId: null };
  }

  async applyForDevices(tenantId: string, deviceIds: string[]) {
    const unique = [...new Set(deviceIds)];
    for (const id of unique) {
      await this.applyForDevice(tenantId, id);
    }
  }

  async applyForRuleScope(
    tenantId: string,
    scope: 'device' | 'group',
    deviceId?: string | null,
    groupId?: string | null
  ) {
    if (scope === 'device' && deviceId) {
      await this.applyForDevice(tenantId, deviceId);
      return;
    }
    if (scope === 'group' && groupId) {
      const members = await this.prisma.deviceGroupMember.findMany({
        where: { groupId },
        select: { deviceId: true },
      });
      await this.applyForDevices(
        tenantId,
        members.map((m) => m.deviceId)
      );
    }
  }
}
