import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import {
  classifyWallDrift,
  computeTileCrop,
  computeWallDriftMs,
  computeWallPlaybackAt,
  normalizeDeviceViewport,
  parseWallSyncFromSnapshot,
  type WallTileCurrentItem,
  type WallTileSyncStatus,
} from '@easysignage/shared-types';
import {
  CreateVideoWallDto,
  SetWallTilesDto,
  UpdateVideoWallDto,
} from './dto/video-wall.dto';
import { RealtimeService } from '../realtime/realtime.service';
import { LicenseService } from '../license/license.service';

const SYNC_LEAD_MS = 3000;
const ONLINE_MS = 5 * 60 * 1000;

function defaultSlideMs(kind: string): number {
  if (kind === 'video' || kind === 'audio') return 30_000;
  if (kind === 'pdf' || kind === 'html') return 20_000;
  return 10_000;
}

@Injectable()
export class VideoWallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly license: LicenseService
  ) {}

  private async assertWallFeature(): Promise<void> {
    await this.license.assertFeature('video_walls');
  }

  async list(tenantId: string) {
    const rows = await this.prisma.videoWall.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { tiles: true } },
      },
    });
    return rows.map((w) => this.serializeWall(w));
  }

  async getById(tenantId: string, id: string) {
    const wall = await this.prisma.videoWall.findFirst({
      where: { id, tenantId },
      include: {
        site: { select: { id: true, name: true } },
        tiles: {
          include: {
            device: {
              select: { id: true, name: true, platform: true, status: true },
            },
          },
          orderBy: [{ row: 'asc' }, { col: 'asc' }],
        },
      },
    });
    if (!wall) throw new NotFoundException('Video wall não encontrada');
    return this.serializeWall(wall);
  }

  async create(tenantId: string, dto: CreateVideoWallDto) {
    await this.assertWallFeature();
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, tenantId },
    });
    if (!site) throw new NotFoundException('Site não encontrado');

    if (dto.playlistId) {
      const pl = await this.prisma.playlist.findFirst({
        where: { id: dto.playlistId, tenantId },
      });
      if (!pl) throw new NotFoundException('Playlist não encontrada');
    }

    const virtualWidth = dto.virtualWidth ?? dto.gridCols * 1920;
    const virtualHeight = dto.virtualHeight ?? dto.gridRows * 1080;

    return this.prisma.videoWall.create({
      data: {
        tenantId,
        siteId: dto.siteId,
        name: dto.name.trim(),
        gridRows: dto.gridRows,
        gridCols: dto.gridCols,
        virtualWidth,
        virtualHeight,
        displayOrientation: dto.displayOrientation ?? 'landscape',
        playlistId: dto.playlistId ?? null,
        revision: this.newRevision(),
      },
      include: { site: { select: { id: true, name: true } } },
    }).then((w) => this.serializeWall(w));
  }

  async update(tenantId: string, id: string, dto: UpdateVideoWallDto) {
    await this.assertWallFeature();
    await this.ensureWall(tenantId, id);
    if (dto.playlistId) {
      const pl = await this.prisma.playlist.findFirst({
        where: { id: dto.playlistId, tenantId },
      });
      if (!pl) throw new NotFoundException('Playlist não encontrada');
    }
    return this.prisma.videoWall.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.playlistId !== undefined ? { playlistId: dto.playlistId } : {}),
        ...(dto.status != null ? { status: dto.status } : {}),
        ...(dto.displayOrientation != null
          ? { displayOrientation: dto.displayOrientation }
          : {}),
        revision: this.newRevision(),
      },
    }).then((w) => this.serializeWall(w));
  }

  async setTiles(tenantId: string, wallId: string, dto: SetWallTilesDto) {
    await this.assertWallFeature();
    const wall = await this.ensureWall(tenantId, wallId);
    const seenCells = new Set<string>();
    const seenDevices = new Set<string>();

    for (const t of dto.tiles) {
      if (t.row >= wall.gridRows || t.col >= wall.gridCols) {
        throw new BadRequestException(
          `Posição inválida (${t.row},${t.col}) para grelha ${wall.gridRows}×${wall.gridCols}`
        );
      }
      const key = `${t.row}:${t.col}`;
      if (seenCells.has(key)) {
        throw new BadRequestException(`Célula duplicada: ${key}`);
      }
      seenCells.add(key);
      if (seenDevices.has(t.deviceId)) {
        throw new BadRequestException('Device duplicado na parede');
      }
      seenDevices.add(t.deviceId);

      const device = await this.prisma.device.findFirst({
        where: { id: t.deviceId, tenantId, siteId: wall.siteId },
      });
      if (!device) {
        throw new NotFoundException(`Device não encontrado ou fora do site: ${t.deviceId}`);
      }

      const otherWall = await this.prisma.videoWallTile.findFirst({
        where: {
          deviceId: t.deviceId,
          wallId: { not: wallId },
        },
      });
      if (otherWall) {
        throw new BadRequestException(
          `Device ${device.name} já pertence a outra video wall`
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.videoWallTile.deleteMany({ where: { wallId } });
      if (dto.tiles.length) {
        await tx.videoWallTile.createMany({
          data: dto.tiles.map((t) => ({
            wallId,
            deviceId: t.deviceId,
            row: t.row,
            col: t.col,
          })),
        });
      }
      await tx.videoWall.update({
        where: { id: wallId },
        data: { revision: this.newRevision() },
      });
    });

    return this.getById(tenantId, wallId);
  }

  async publish(tenantId: string, wallId: string) {
    await this.assertWallFeature();
    const wall = await this.getById(tenantId, wallId);
    if (!wall.playlistId) {
      throw new BadRequestException('Defina uma playlist na parede antes de publicar');
    }
    if (!wall.tiles.length) {
      throw new BadRequestException('Mapeie pelo menos um tile antes de publicar');
    }

    const epochMs = BigInt(Date.now() + SYNC_LEAD_MS);
    const updated = await this.prisma.videoWall.update({
      where: { id: wallId },
      data: {
        status: 'active',
        syncEpochMs: epochMs,
        revision: this.newRevision(),
      },
      include: {
        tiles: { include: { device: true } },
      },
    });

    await this.applyWallToDevices(tenantId, updated);
    await this.realtime.broadcastWallSync({
      wallId,
      syncEpochMs: Number(epochMs),
      wallRevision: updated.revision,
      toleranceMs: updated.syncToleranceMs,
    });
    return { ok: true, syncEpochMs: epochMs.toString(), tileCount: updated.tiles.length };
  }

  async sync(tenantId: string, wallId: string) {
    await this.assertWallFeature();
    const wall = await this.ensureWall(tenantId, wallId);
    const tiles = await this.prisma.videoWallTile.findMany({
      where: { wallId },
      include: { device: true },
    });
    if (!tiles.length) {
      throw new BadRequestException('Parede sem tiles mapeados');
    }

    const epochMs = BigInt(Date.now() + SYNC_LEAD_MS);
    const updated = await this.prisma.videoWall.update({
      where: { id: wallId },
      data: { syncEpochMs: epochMs, revision: this.newRevision() },
      include: { tiles: { include: { device: true } } },
    });

    await this.applyWallToDevices(tenantId, updated);
    await this.realtime.broadcastWallSync({
      wallId,
      syncEpochMs: Number(epochMs),
      wallRevision: updated.revision,
      toleranceMs: updated.syncToleranceMs,
    });
    return { ok: true, syncEpochMs: epochMs.toString() };
  }

  /** Saúde de sync por tile — drift a partir do heartbeat/telemetria. */
  async getSyncHealth(tenantId: string, wallId: string) {
    const wall = await this.getById(tenantId, wallId);
    const nowMs = Date.now();
    const epochMs = wall.syncEpochMs ? Number(wall.syncEpochMs) : null;

    let slideTimings: { durationMs: number }[] = [];
    if (wall.playlistId) {
      const items = await this.prisma.playlistItem.findMany({
        where: { playlistId: wall.playlistId },
        orderBy: { position: 'asc' },
        include: { asset: { select: { kind: true } } },
      });
      slideTimings = items.map((it) => ({
        durationMs:
          it.durationSec != null
            ? Math.max(1, it.durationSec) * 1000
            : defaultSlideMs(it.asset.kind),
      }));
    }

    const expected =
      epochMs != null && slideTimings.length
        ? computeWallPlaybackAt(slideTimings, epochMs, nowMs)
        : null;

    const tiles = await Promise.all(
      wall.tiles.map(async (t) => {
        const device = await this.prisma.device.findFirst({
          where: { id: t.deviceId, tenantId },
          select: {
            id: true,
            name: true,
            lastSeenAt: true,
            state: { select: { telemetrySnapshotJson: true, telemetryUpdatedAt: true } },
          },
        });

        const lastSeen = device?.lastSeenAt?.getTime() ?? 0;
        const online = lastSeen > 0 && nowMs - lastSeen <= ONLINE_MS;
        const snap = device?.state?.telemetrySnapshotJson as Record<
          string,
          unknown
        > | null;
        const reported = parseWallSyncFromSnapshot(snap);

        let status: WallTileSyncStatus = 'no_data';
        let itemIndex: number | null = null;
        let positionMs: number | null = null;
        let driftMs: number | null = null;
        let reportedAt: string | null = null;

        if (!online) {
          status = 'offline';
        } else if (!reported || reported.wallId !== wallId) {
          status = 'no_data';
        } else {
          itemIndex = reported.itemIndex;
          positionMs = reported.positionMs;
          driftMs = reported.driftMs;
          const rawAt = snap?.wallSync;
          if (rawAt && typeof rawAt === 'object' && !Array.isArray(rawAt)) {
            const ra = (rawAt as Record<string, unknown>).reportedAt;
            if (typeof ra === 'string') reportedAt = ra;
          }
          const itemMatch =
            expected == null ? true : reported.itemIndex === expected.itemIndex;
          if (epochMs != null && slideTimings.length) {
            const serverDrift = computeWallDriftMs(
              slideTimings,
              epochMs,
              nowMs,
              { itemIndex: reported.itemIndex, positionMs: reported.positionMs }
            );
            driftMs = serverDrift;
          }
          status = classifyWallDrift(
            driftMs ?? 0,
            wall.syncToleranceMs,
            itemMatch
          );
        }

        return {
          row: t.row,
          col: t.col,
          deviceId: t.deviceId,
          deviceName: device?.name ?? t.device.name,
          online,
          status,
          itemIndex,
          positionMs,
          driftMs,
          reportedAt,
          telemetryUpdatedAt: device?.state?.telemetryUpdatedAt?.toISOString() ?? null,
        };
      })
    );

    const onlineTiles = tiles.filter((t) => t.online && t.status !== 'no_data');
    const maxDrift =
      onlineTiles.length > 0
        ? Math.max(...onlineTiles.map((t) => Math.abs(t.driftMs ?? 0)))
        : null;

    let groupStatus: WallTileSyncStatus = 'no_data';
    if (!tiles.length) groupStatus = 'no_data';
    else if (tiles.every((t) => t.status === 'offline')) groupStatus = 'offline';
    else if (tiles.some((t) => t.status === 'critical')) groupStatus = 'critical';
    else if (tiles.some((t) => t.status === 'warn')) groupStatus = 'warn';
    else if (onlineTiles.length === tiles.length && tiles.every((t) => t.status === 'ok')) {
      groupStatus = 'ok';
    } else if (onlineTiles.length > 0) groupStatus = 'warn';

    return {
      wallId: wall.id,
      status: wall.status,
      syncEpochMs: wall.syncEpochMs,
      syncToleranceMs: wall.syncToleranceMs,
      expectedItemIndex: expected?.itemIndex ?? null,
      expectedPositionMs: expected?.positionMs ?? null,
      maxDriftMs: maxDrift,
      groupStatus,
      tiles,
      checkedAt: new Date().toISOString(),
    };
  }

  /** Monta payload wall_tile para um device membro da parede. */
  async buildTileCurrentItem(
    tenantId: string,
    wallId: string,
    deviceId: string
  ): Promise<WallTileCurrentItem> {
    const tile = await this.prisma.videoWallTile.findFirst({
      where: { wallId, deviceId },
      include: { wall: true, device: true },
    });
    if (!tile || tile.wall.tenantId !== tenantId) {
      throw new NotFoundException('Tile não encontrado nesta parede');
    }
    return this.tileToCurrentItem(tile.wall, tile);
  }

  private tileToCurrentItem(
    wall: {
      id: string;
      revision: string;
      gridRows: number;
      gridCols: number;
      virtualWidth: number;
      virtualHeight: number;
      displayOrientation: string;
      playlistId: string | null;
      syncEpochMs: bigint | null;
      syncToleranceMs: number;
    },
    tile: { row: number; col: number; device: { viewportWidth: number; viewportHeight: number; displayOrientation: string } }
  ): WallTileCurrentItem {
    if (!wall.playlistId) {
      throw new BadRequestException('Parede sem playlist definida');
    }
    const virtualCanvas = { width: wall.virtualWidth, height: wall.virtualHeight };
    const crop = computeTileCrop(
      virtualCanvas,
      wall.gridRows,
      wall.gridCols,
      tile.row,
      tile.col
    );
    const viewport = normalizeDeviceViewport({
      viewportWidth: tile.device.viewportWidth,
      viewportHeight: tile.device.viewportHeight,
      displayOrientation: tile.device.displayOrientation,
    });
    const epochMs = wall.syncEpochMs
      ? Number(wall.syncEpochMs)
      : Date.now() + SYNC_LEAD_MS;

    return {
      type: 'wall_tile',
      wallId: wall.id,
      wallRevision: wall.revision,
      tile: {
        row: tile.row,
        col: tile.col,
        rows: wall.gridRows,
        cols: wall.gridCols,
      },
      viewport,
      virtualCanvas,
      crop,
      source: { type: 'playlist', playlistId: wall.playlistId },
      sync: {
        groupId: wall.id,
        epochMs,
        toleranceMs: wall.syncToleranceMs,
      },
      display: { fit: 'cover' },
    };
  }

  private async applyWallToDevices(
    tenantId: string,
    wall: {
      id: string;
      revision: string;
      gridRows: number;
      gridCols: number;
      virtualWidth: number;
      virtualHeight: number;
      displayOrientation: string;
      playlistId: string | null;
      syncEpochMs: bigint | null;
      syncToleranceMs: number;
      tiles: Array<{
        row: number;
        col: number;
        deviceId: string;
        device: { viewportWidth: number; viewportHeight: number; displayOrientation: string };
      }>;
    }
  ) {
    for (const tile of wall.tiles) {
      const currentItem = this.tileToCurrentItem(wall, {
        row: tile.row,
        col: tile.col,
        device: tile.device,
      });
      const itemJson = currentItem as unknown as Prisma.InputJsonValue;
      await this.prisma.deviceState.upsert({
        where: { deviceId: tile.deviceId },
        create: {
          deviceId: tile.deviceId,
          tenantId,
          currentItemJson: itemJson,
          scheduleBaselineItemJson: itemJson,
          activeScheduleRuleId: null,
          lastSyncAt: new Date(),
          currentPublicationId: null,
          appliedPublicationVersion: null,
          appliedContentRevision: null,
          appliedAt: null,
        },
        update: {
          currentItemJson: itemJson,
          scheduleBaselineItemJson: itemJson,
          activeScheduleRuleId: null,
          lastSyncAt: new Date(),
          currentPublicationId: null,
          appliedPublicationVersion: null,
          appliedContentRevision: null,
          appliedAt: null,
        },
      });
    }
  }

  private async ensureWall(tenantId: string, id: string) {
    const wall = await this.prisma.videoWall.findFirst({
      where: { id, tenantId },
    });
    if (!wall) throw new NotFoundException('Video wall não encontrada');
    return wall;
  }

  private newRevision() {
    return createHash('sha256')
      .update(String(Date.now()) + Math.random())
      .digest('hex')
      .slice(0, 16);
  }

  private serializeWall<T extends { syncEpochMs?: bigint | null }>(wall: T) {
    return {
      ...wall,
      syncEpochMs:
        wall.syncEpochMs != null ? wall.syncEpochMs.toString() : null,
    };
  }
}
