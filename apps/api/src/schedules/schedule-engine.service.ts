import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma-client';
import { PrismaService } from '../prisma/prisma.service';

export const SCHEDULE_CONTENT_SOURCE = 'schedule';

export type SchedulePlaybackItem = {
  type: 'playlist';
  playlistId: string;
  source: typeof SCHEDULE_CONTENT_SOURCE;
  scheduleRuleId: string;
};

function isScheduleItem(item: unknown): item is SchedulePlaybackItem {
  if (!item || typeof item !== 'object') return false;
  const o = item as Record<string, unknown>;
  return o.source === SCHEDULE_CONTENT_SOURCE;
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
  constructor(private readonly prisma: PrismaService) {}

  private timeZone(): string {
    return process.env.SCHEDULE_TIMEZONE?.trim() || 'Europe/Lisbon';
  }

  /** Resolve a regra ativa com maior prioridade para o device neste instante. */
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
    if (state?.currentItemJson != null && !isScheduleItem(state.currentItemJson)) {
      return state.currentItemJson as Prisma.InputJsonValue;
    }
    return null;
  }

  /**
   * Aplica ou remove conteúdo de agenda em `device_state.current_item_json`.
   * Chamado no poll de estado / heartbeat do player.
   */
  async applyForDevice(
    tenantId: string,
    deviceId: string,
    now = new Date()
  ): Promise<{ applied: boolean; activeRuleId: string | null }> {
    const rule = await this.findActiveRule(tenantId, deviceId, now);
    const state = await this.prisma.deviceState.findUnique({
      where: { deviceId },
    });

    const nowDate = new Date();

    if (rule) {
      const scheduledItem: SchedulePlaybackItem = {
        type: 'playlist',
        playlistId: rule.playlistId,
        source: SCHEDULE_CONTENT_SOURCE,
        scheduleRuleId: rule.id,
      };

      const alreadyActive =
        state?.activeScheduleRuleId === rule.id &&
        itemsEqual(state.currentItemJson, scheduledItem);

      if (alreadyActive) {
        return { applied: false, activeRuleId: rule.id };
      }

      let baseline: Prisma.InputJsonValue | undefined =
        state?.scheduleBaselineItemJson != null
          ? (state.scheduleBaselineItemJson as Prisma.InputJsonValue)
          : undefined;
      if (baseline == null && state?.currentItemJson != null) {
        if (!isScheduleItem(state.currentItemJson)) {
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
          currentItemJson: scheduledItem as Prisma.InputJsonValue,
          scheduleBaselineItemJson: baseline,
          activeScheduleRuleId: rule.id,
          lastSyncAt: nowDate,
        },
        update: {
          currentItemJson: scheduledItem as Prisma.InputJsonValue,
          ...(baseline != null ? { scheduleBaselineItemJson: baseline } : {}),
          activeScheduleRuleId: rule.id,
          lastSyncAt: nowDate,
        },
      });

      return { applied: true, activeRuleId: rule.id };
    }

    if (!state?.activeScheduleRuleId) {
      return { applied: false, activeRuleId: null };
    }

    const fallback = await this.resolveFallbackItem(tenantId, deviceId, state);

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

  /** Após alteração de regras: reavalia devices afetados. */
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
