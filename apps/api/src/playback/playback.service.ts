import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  PlaybackEventInput,
  PlaybackLogFilters,
  PlaybackLogPage,
  PlaybackLogRow,
} from '@easysignage/shared-types';

const MAX_PAGE_SIZE = 500;

type PlaybackLogWithRelations = {
  id: string;
  deviceId: string;
  device: { name: string };
  itemType: string;
  assetId: string | null;
  asset: { name: string } | null;
  playlistId: string | null;
  playlist: { name: string } | null;
  eventType: string;
  startedAt: Date;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: Date;
};

@Injectable()
export class PlaybackService {
  constructor(private readonly prisma: PrismaService) {}

  async ingestBatch(
    tenantId: string,
    deviceId: string,
    events: PlaybackEventInput[]
  ): Promise<{ accepted: number }> {
    if (!events.length) return { accepted: 0 };

    const rows: Prisma.PlaybackLogCreateManyInput[] = events.map((e) => ({
      tenantId,
      deviceId,
      itemType: e.itemType,
      assetId: e.assetId ?? null,
      playlistId: e.playlistId ?? null,
      eventType: e.eventType,
      startedAt: new Date(e.startedAt),
      durationMs: e.durationMs ?? null,
      errorMessage: e.errorMessage ?? null,
      metaJson: (e.meta as Prisma.InputJsonValue | undefined) ?? undefined,
    }));

    await this.prisma.playbackLog.createMany({ data: rows });
    return { accepted: rows.length };
  }

  private buildWhere(
    tenantId: string,
    filters: PlaybackLogFilters
  ): Prisma.PlaybackLogWhereInput {
    const where: Prisma.PlaybackLogWhereInput = { tenantId };
    if (filters.deviceId) where.deviceId = filters.deviceId;
    if (filters.assetId) where.assetId = filters.assetId;
    if (filters.playlistId) where.playlistId = filters.playlistId;
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.from || filters.to) {
      where.startedAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }
    return where;
  }

  private toRow(r: PlaybackLogWithRelations): PlaybackLogRow {
    return {
      id: r.id,
      deviceId: r.deviceId,
      deviceName: r.device.name,
      itemType: r.itemType as PlaybackLogRow['itemType'],
      assetId: r.assetId,
      assetName: r.asset?.name ?? null,
      playlistId: r.playlistId,
      playlistName: r.playlist?.name ?? null,
      eventType: r.eventType as PlaybackLogRow['eventType'],
      startedAt: r.startedAt.toISOString(),
      durationMs: r.durationMs,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async list(tenantId: string, filters: PlaybackLogFilters): Promise<PlaybackLogPage> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? 50));
    const where = this.buildWhere(tenantId, filters);

    const [rows, total] = await Promise.all([
      this.prisma.playbackLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          device: { select: { name: true } },
          asset: { select: { name: true } },
          playlist: { select: { name: true } },
        },
      }),
      this.prisma.playbackLog.count({ where }),
    ]);

    return {
      rows: rows.map((r) => this.toRow(r as unknown as PlaybackLogWithRelations)),
      total,
      page,
      pageSize,
    };
  }

  /** Exportação completa (sem paginação, limitada a MAX_EXPORT_ROWS) para CSV. */
  async listForExport(
    tenantId: string,
    filters: PlaybackLogFilters
  ): Promise<PlaybackLogRow[]> {
    const MAX_EXPORT_ROWS = 20_000;
    const where = this.buildWhere(tenantId, filters);
    const rows = await this.prisma.playbackLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      include: {
        device: { select: { name: true } },
        asset: { select: { name: true } },
        playlist: { select: { name: true } },
      },
    });
    return rows.map((r) => this.toRow(r as unknown as PlaybackLogWithRelations));
  }

  toCsv(rows: PlaybackLogRow[]): string {
    const header = [
      'id',
      'deviceName',
      'itemType',
      'assetName',
      'playlistName',
      'eventType',
      'startedAt',
      'durationMs',
      'errorMessage',
    ];
    const escape = (v: unknown): string => {
      if (v == null) return '';
      const s = String(v);
      if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.deviceName,
          r.itemType,
          r.assetName ?? '',
          r.playlistName ?? '',
          r.eventType,
          r.startedAt,
          r.durationMs ?? '',
          r.errorMessage ?? '',
        ]
          .map(escape)
          .join(',')
      );
    }
    return lines.join('\n');
  }
}
