import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { WolService } from './wol.service';
import { TelemetryBatchDto } from './dto/telemetry-batch.dto';

const MAX_EVENTS_PER_BATCH = 100;
const DEFAULT_EVENT_LIMIT = 80;

/** Heartbeat típico 60s; abaixo disto consideramos o device “ao vivo”. */
const MONITORING_ONLINE_MS = 5 * 60 * 1000;
const MONITORING_OFFLINE_LONG_MS = 24 * 60 * 60 * 1000;

function snapshotIndicatesFault(snapshot: Record<string, unknown> | null): boolean {
  if (!snapshot) return false;
  if (snapshot.connected === false) return true;
  if (snapshot.communicationOk === false) return true;
  if (snapshot.networkError === true) return true;
  const pb = snapshot.playback;
  if (pb && typeof pb === 'object') {
    const p = pb as Record<string, unknown>;
    if (p.state === 'error' || p.health === 'error') return true;
  }
  return false;
}

function computeMonitoringBorder(
  lastSeenAt: Date | null,
  snapshot: Record<string, unknown> | null
): 'online' | 'fault' | 'offline_long' {
  if (!lastSeenAt) return 'offline_long';
  const age = Date.now() - lastSeenAt.getTime();
  if (age > MONITORING_OFFLINE_LONG_MS) return 'offline_long';
  if (snapshotIndicatesFault(snapshot)) return 'fault';
  if (age > MONITORING_ONLINE_MS) return 'fault';
  return 'online';
}

export interface UptimeHistoryPoint {
  /** Data (UTC) no formato `YYYY-MM-DD`. */
  date: string;
  /** % de devices do tenant com pelo menos um heartbeat nesse dia (0–100, 1 decimal). */
  onlinePct: number;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type ParsedPlayback = {
  playlistId?: string;
  playlistNameFromTelemetry?: string;
  assetId?: string;
  assetNameFromTelemetry?: string;
  itemIndex?: number;
};

function parsePlaybackFromState(
  currentItemJson: unknown,
  snapshot: Record<string, unknown> | null
): ParsedPlayback {
  const out: ParsedPlayback = {};
  if (snapshot?.playback && typeof snapshot.playback === 'object') {
    const pb = snapshot.playback as Record<string, unknown>;
    if (typeof pb.playlistId === 'string') out.playlistId = pb.playlistId;
    if (typeof pb.playlistName === 'string') {
      out.playlistNameFromTelemetry = pb.playlistName;
    }
    if (typeof pb.assetId === 'string') out.assetId = pb.assetId;
    if (typeof pb.assetName === 'string') out.assetNameFromTelemetry = pb.assetName;
    if (typeof pb.itemIndex === 'number') out.itemIndex = pb.itemIndex;
    else if (typeof pb.slideIndex === 'number') out.itemIndex = pb.slideIndex;
  }
  const ci = currentItemJson as Record<string, unknown> | null | undefined;
  if (ci && typeof ci === 'object') {
    if (ci.type === 'playlist' && typeof ci.playlistId === 'string') {
      out.playlistId = out.playlistId ?? ci.playlistId;
    }
    if (
      (ci.type === 'asset' || ci.type === 'image') &&
      typeof ci.assetId === 'string'
    ) {
      out.assetId = out.assetId ?? ci.assetId;
    }
  }
  return out;
}

@Injectable()
export class TelemetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wol: WolService
  ) {}

  /** Ingestão pelo player: atualiza snapshot em `device_state` e regista eventos. */
  async ingestFromDevice(
    tenantId: string,
    deviceId: string,
    dto: TelemetryBatchDto
  ) {
    const events = dto.events ?? [];
    if (events.length > MAX_EVENTS_PER_BATCH) {
      throw new BadRequestException(
        `Máximo ${MAX_EVENTS_PER_BATCH} eventos por pedido`
      );
    }

    const now = new Date();

    await this.prisma.device.update({
      where: { id: deviceId, tenantId },
      data: { lastSeenAt: now },
    });

    if (dto.snapshot != null) {
      const snap = dto.snapshot as Prisma.InputJsonValue;
      await this.prisma.deviceState.upsert({
        where: { deviceId },
        create: {
          deviceId,
          tenantId,
          telemetrySnapshotJson: snap,
          telemetryUpdatedAt: now,
        },
        update: {
          telemetrySnapshotJson: snap,
          telemetryUpdatedAt: now,
        },
      });
    }

    if (events.length > 0) {
      await this.prisma.deviceTelemetryEvent.createMany({
        data: events.map((e) => ({
          tenantId,
          deviceId,
          category: e.category.trim().slice(0, 64),
          severity: e.severity,
          code: e.code?.trim().slice(0, 64) ?? null,
          message: e.message?.trim().slice(0, 2000) ?? null,
          payloadJson: e.payload
            ? (e.payload as Prisma.InputJsonValue)
            : undefined,
        })),
      });
    }

    return {
      ok: true,
      serverTime: now.toISOString(),
      acceptedEvents: events.length,
    };
  }

  /** Lista resumida para o CMS (monitorização / overview). */
  async overviewForTenant(tenantId: string) {
    const devices = await this.prisma.device.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        platform: true,
        status: true,
        lastSeenAt: true,
        site: { select: { id: true, name: true } },
        state: {
          select: {
            telemetrySnapshotJson: true,
            telemetryUpdatedAt: true,
            networkStatus: true,
            currentItemJson: true,
            previewSnapshotAt: true,
            previewSnapshotKey: true,
          },
        },
      },
    });

    const playlistIds = new Set<string>();
    const assetIds = new Set<string>();
    for (const d of devices) {
      const snap = d.state?.telemetrySnapshotJson as Record<
        string,
        unknown
      > | null;
      const p = parsePlaybackFromState(d.state?.currentItemJson, snap);
      if (p.playlistId) playlistIds.add(p.playlistId);
      if (p.assetId) assetIds.add(p.assetId);
    }

    const [playlists, assets] = await Promise.all([
      playlistIds.size > 0
        ? this.prisma.playlist.findMany({
            where: { tenantId, id: { in: [...playlistIds] } },
            select: { id: true, name: true },
          })
        : [],
      assetIds.size > 0
        ? this.prisma.asset.findMany({
            where: { tenantId, id: { in: [...assetIds] } },
            select: { id: true, name: true },
          })
        : [],
    ]);
    const plMap = new Map(playlists.map((x) => [x.id, x.name]));
    const asMap = new Map(assets.map((x) => [x.id, x.name]));

    return devices.map((d) => {
      const snap = d.state?.telemetrySnapshotJson as Record<
        string,
        unknown
      > | null;
      const parsed = parsePlaybackFromState(d.state?.currentItemJson, snap);
      const playlistName =
        parsed.playlistNameFromTelemetry ??
        (parsed.playlistId ? plMap.get(parsed.playlistId) ?? null : null);
      const assetName =
        parsed.assetNameFromTelemetry ??
        (parsed.assetId ? asMap.get(parsed.assetId) ?? null : null);

      const borderStatus = computeMonitoringBorder(
        d.lastSeenAt,
        snap
      );

      return {
        deviceId: d.id,
        name: d.name,
        platform: d.platform,
        status: d.status,
        lastSeenAt: d.lastSeenAt,
        site: d.site,
        telemetryUpdatedAt: d.state?.telemetryUpdatedAt ?? null,
        telemetrySnapshot: d.state?.telemetrySnapshotJson ?? null,
        networkStatus: d.state?.networkStatus ?? null,
        currentItem: d.state?.currentItemJson ?? null,
        borderStatus,
        playback: {
          playlistId: parsed.playlistId ?? null,
          playlistName,
          assetId: parsed.assetId ?? null,
          assetName,
          itemIndex: parsed.itemIndex ?? null,
        },
        previewSnapshotAt: d.state?.previewSnapshotAt ?? null,
        hasPreview: Boolean(d.state?.previewSnapshotKey),
      };
    });
  }

  /**
   * Histórico de disponibilidade da rede (PR 5.17 — substitui o array
   * `DEMO_UPTIME` fixo no dashboard do CMS). Para cada dia dos últimos
   * `days`, calcula `deviceCount / totalDevices` a partir de heartbeats
   * distintos por device em `heartbeats` — uma aproximação real e simples
   * de "% de players que estiveram online naquele dia", sem depender de
   * telemetria minuto-a-minuto.
   */
  async uptimeHistory(
    tenantId: string,
    days = 24
  ): Promise<UptimeHistoryPoint[]> {
    const clampedDays = Math.min(Math.max(1, Math.floor(days) || 24), 90);
    const totalDevices = await this.prisma.device.count({ where: { tenantId } });

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (clampedDays - 1));

    const byDay = new Map<string, number>();
    if (totalDevices > 0) {
      const rows = await this.prisma.$queryRaw<
        { day: Date; deviceCount: bigint }[]
      >`SELECT date_trunc('day', received_at) AS day, COUNT(DISTINCT device_id) AS "deviceCount"
        FROM heartbeats
        WHERE tenant_id = ${tenantId}::uuid AND received_at >= ${since}
        GROUP BY 1
        ORDER BY 1`;
      for (const r of rows) {
        byDay.set(dayKey(new Date(r.day)), Number(r.deviceCount));
      }
    }

    const points: UptimeHistoryPoint[] = [];
    for (let i = 0; i < clampedDays; i++) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      const key = dayKey(d);
      const seenDevices = Math.min(byDay.get(key) ?? 0, totalDevices);
      const onlinePct =
        totalDevices > 0
          ? Math.round((seenDevices / totalDevices) * 1000) / 10
          : 0;
      points.push({ date: key, onlinePct });
    }
    return points;
  }

  async getDeviceSnapshot(tenantId: string, deviceId: string) {
    const d = await this.prisma.device.findFirst({
      where: { id: deviceId, tenantId },
      include: {
        state: true,
        site: { select: { id: true, name: true } },
      },
    });
    if (!d) return null;
    return {
      deviceId: d.id,
      name: d.name,
      platform: d.platform,
      status: d.status,
      lastSeenAt: d.lastSeenAt,
      site: d.site,
      state: d.state,
    };
  }

  async listEvents(
    tenantId: string,
    deviceId: string,
    limit = DEFAULT_EVENT_LIMIT
  ) {
    const take = Math.min(Math.max(1, limit), 500);
    return this.prisma.deviceTelemetryEvent.findMany({
      where: { tenantId, deviceId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async enqueueCommand(
    tenantId: string,
    deviceId: string,
    channel: string,
    payload: Record<string, unknown>
  ) {
    const d = await this.prisma.device.findFirst({
      where: { id: deviceId, tenantId },
      select: { id: true, wakeMac: true },
    });
    if (!d) throw new NotFoundException('Device não encontrado');

    const ch = channel.trim().toLowerCase().slice(0, 64);

    const row = await this.prisma.deviceCommand.create({
      data: {
        tenantId,
        deviceId,
        channel: ch,
        status: 'pending',
        payloadJson: payload as Prisma.InputJsonValue,
      },
    });

    if (ch === 'wol') {
      const mac =
        (typeof payload.macAddress === 'string' && payload.macAddress.trim()) ||
        (typeof payload.mac === 'string' && payload.mac.trim()) ||
        d.wakeMac?.trim() ||
        '';
      const now = new Date();
      if (!mac) {
        await this.prisma.deviceCommand.update({
          where: { id: row.id },
          data: {
            status: 'failed',
            processedAt: now,
            resultJson: {
              error:
                'MAC não definido (use payload.macAddress ou wakeMac no device)',
            } as Prisma.InputJsonValue,
          },
        });
      } else {
        try {
          const broadcast =
            typeof payload.broadcast === 'string' ? payload.broadcast : undefined;
          const port =
            typeof payload.port === 'number' && Number.isFinite(payload.port)
              ? Math.floor(payload.port)
              : undefined;
          await this.wol.send(mac, { broadcast, port });
          await this.prisma.deviceCommand.update({
            where: { id: row.id },
            data: {
              status: 'acked',
              processedAt: now,
              resultJson: {
                wolSent: true,
                mac,
              } as Prisma.InputJsonValue,
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await this.prisma.deviceCommand.update({
            where: { id: row.id },
            data: {
              status: 'failed',
              processedAt: now,
              resultJson: { error: msg } as Prisma.InputJsonValue,
            },
          });
        }
      }
      return this.prisma.deviceCommand.findUniqueOrThrow({
        where: { id: row.id },
      });
    }

    return row;
  }

  async pollPendingCommands(tenantId: string, deviceId: string) {
    return this.prisma.deviceCommand.findMany({
      where: { tenantId, deviceId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 25,
      select: {
        id: true,
        channel: true,
        payloadJson: true,
        createdAt: true,
      },
    });
  }

  async ackCommand(
    tenantId: string,
    deviceId: string,
    commandId: string,
    ok: boolean,
    result?: Record<string, unknown>
  ) {
    const cmd = await this.prisma.deviceCommand.findFirst({
      where: { id: commandId, deviceId, tenantId },
    });
    if (!cmd) throw new NotFoundException('Comando não encontrado');
    if (cmd.status !== 'pending') {
      return { ok: true, id: commandId, alreadyHandled: true };
    }
    await this.prisma.deviceCommand.update({
      where: { id: commandId },
      data: {
        status: ok ? 'acked' : 'failed',
        resultJson: result
          ? (result as Prisma.InputJsonValue)
          : undefined,
        processedAt: new Date(),
      },
    });
    return { ok: true, id: commandId };
  }

  async listCommandsForDevice(
    tenantId: string,
    deviceId: string,
    limit = 40
  ) {
    return this.prisma.deviceCommand.findMany({
      where: { tenantId, deviceId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }
}
