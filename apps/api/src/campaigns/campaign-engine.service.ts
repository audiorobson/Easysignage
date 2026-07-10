import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CAMPAIGN_CONTENT_SOURCE } from '@easysignage/shared-types';
import { getLocalScheduleContext } from '../schedules/schedule-engine.service';

export type ActiveCampaignRow = {
  id: string;
  playlistId: string;
  priority: number;
};

@Injectable()
export class CampaignEngineService {
  constructor(private readonly prisma: PrismaService) {}

  private timeZone(): string {
    return process.env.SCHEDULE_TIMEZONE?.trim() || 'Europe/Lisbon';
  }

  private matchesDateRange(
    now: Date,
    startAt: Date | null,
    endAt: Date | null
  ): boolean {
    if (startAt && now < startAt) return false;
    if (endAt && now > endAt) return false;
    return true;
  }

  private matchesTimeWindow(
    now: Date,
    dayOfWeek: number | null,
    startMin: number | null,
    endMin: number | null
  ): boolean {
    if (startMin == null && endMin == null) return true;
    if (startMin == null || endMin == null) return false;
    const ctx = getLocalScheduleContext(now, this.timeZone());
    if (dayOfWeek != null && ctx.dayOfWeek !== dayOfWeek) return false;
    return ctx.minutes >= startMin && ctx.minutes < endMin;
  }

  async findActiveCampaign(
    tenantId: string,
    deviceId: string,
    now = new Date()
  ): Promise<ActiveCampaignRow | null> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, tenantId },
      select: { siteId: true },
    });
    if (!device) return null;

    const memberships = await this.prisma.deviceGroupMember.findMany({
      where: { deviceId },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);

    const candidates = await this.prisma.campaign.findMany({
      where: {
        tenantId,
        status: 'active',
        OR: [
          { scope: 'all' },
          { scope: 'device', deviceId },
          { scope: 'site', siteId: device.siteId },
          ...(groupIds.length
            ? [{ scope: 'group', groupId: { in: groupIds } }]
            : []),
        ],
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        playlistId: true,
        priority: true,
        startAt: true,
        endAt: true,
        dayOfWeek: true,
        startMin: true,
        endMin: true,
      },
    });

    for (const c of candidates) {
      if (!this.matchesDateRange(now, c.startAt, c.endAt)) continue;
      if (
        !this.matchesTimeWindow(now, c.dayOfWeek, c.startMin, c.endMin)
      ) {
        continue;
      }
      return { id: c.id, playlistId: c.playlistId, priority: c.priority };
    }
    return null;
  }

  buildCampaignItem(campaign: ActiveCampaignRow): Record<string, unknown> {
    return {
      type: 'playlist',
      playlistId: campaign.playlistId,
      source: CAMPAIGN_CONTENT_SOURCE,
      campaignId: campaign.id,
    };
  }

  async resolveDeviceIdsForScope(
    tenantId: string,
    scope: string,
    deviceId?: string | null,
    groupId?: string | null,
    siteId?: string | null
  ): Promise<string[]> {
    if (scope === 'device' && deviceId) return [deviceId];
    if (scope === 'group' && groupId) {
      const members = await this.prisma.deviceGroupMember.findMany({
        where: { groupId, group: { tenantId } },
        select: { deviceId: true },
      });
      return members.map((m) => m.deviceId);
    }
    if (scope === 'site' && siteId) {
      const devices = await this.prisma.device.findMany({
        where: { tenantId, siteId },
        select: { id: true },
      });
      return devices.map((d) => d.id);
    }
    if (scope === 'all') {
      const devices = await this.prisma.device.findMany({
        where: { tenantId },
        select: { id: true },
      });
      return devices.map((d) => d.id);
    }
    return [];
  }
}
