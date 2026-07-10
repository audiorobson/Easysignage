import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { generateDeviceToken, generatePairingCode, hashToken } from '../common/crypto';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { UpdateDeviceViewportDto } from './dto/update-device-viewport.dto';
import { AssignTestContentDto } from './dto/assign-test-content.dto';
import { PublishDeviceDto } from './dto/publish-device.dto';
import { UpsertDeviceLayoutDto } from './dto/upsert-device-layout.dto';
import { ContentDisplayDto } from './dto/content-display.dto';
import {
  normalizeDeviceViewport,
  normalizeContentDisplay,
  type LayoutTemplateZone,
  type LayoutZoneBinding,
  type LayoutZoneFrame,
  type ContentDisplay,
} from '@easysignage/shared-types';
import { VideoWallsService } from '../video-walls/video-walls.service';

const PAIRING_TTL_MS = 30 * 60 * 1000;

/** Heartbeat mais recente que isto = considerado “online” na listagem filtrada */
const ONLINE_LAST_SEEN_MS = 5 * 60 * 1000;

export type DeviceListFilters = {
  siteId?: string;
  platform?: string;
  status?: string;
  /** "true" | "false" — filtra por último heartbeat dentro do limite ONLINE_LAST_SEEN_MS */
  online?: string;
};

function normalizeWakeMac(raw: string): string | null {
  const hex = raw.replace(/[:-]/g, '').toLowerCase();
  if (!/^[0-9a-f]{12}$/.test(hex)) return null;
  return hex.match(/.{2}/g)!.join(':');
}

function maskDevice(d: {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  serialNumber: string | null;
  platform: string;
  runtimeVersion: string | null;
  status: string;
  lastSeenAt: Date | null;
  pairingExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  wakeMac?: string | null;
  viewportWidth?: number;
  viewportHeight?: number;
  displayOrientation?: string;
  site?: { name: string; code: string | null };
}) {
  const viewport = normalizeDeviceViewport({
    viewportWidth: d.viewportWidth,
    viewportHeight: d.viewportHeight,
    displayOrientation: d.displayOrientation,
  });
  return {
    id: d.id,
    siteId: d.siteId,
    siteName: d.site?.name,
    name: d.name,
    serialNumber: d.serialNumber,
    platform: d.platform,
    runtimeVersion: d.runtimeVersion,
    status: d.status,
    lastSeenAt: d.lastSeenAt,
    pairingExpiresAt: d.pairingExpiresAt,
    wakeMac: d.wakeMac ?? null,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    displayOrientation: viewport.orientation,
    viewport,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly videoWalls: VideoWallsService
  ) {}

  async list(tenantId: string, filters: DeviceListFilters = {}) {
    const threshold = new Date(Date.now() - ONLINE_LAST_SEEN_MS);

    const where: Prisma.DeviceWhereInput = { tenantId };
    if (filters.siteId) where.siteId = filters.siteId;
    if (filters.platform) where.platform = filters.platform;
    if (filters.status) where.status = filters.status;

    if (filters.online === 'true') {
      where.lastSeenAt = { gte: threshold };
    } else if (filters.online === 'false') {
      where.OR = [{ lastSeenAt: null }, { lastSeenAt: { lt: threshold } }];
    }

    const list = await this.prisma.device.findMany({
      where,
      include: { site: true },
      orderBy: { name: 'asc' },
    });
    return list.map((d) => maskDevice(d));
  }

  /** Estado operacional para o CMS (JWT): device + device_state + último heartbeat */
  async getAdminState(tenantId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, tenantId },
      include: { site: true },
    });
    if (!device) throw new NotFoundException('Dispositivo não encontrado');

    const [state, lastHeartbeat] = await Promise.all([
      this.prisma.deviceState.findUnique({
        where: { deviceId },
        include: {
          currentPublication: { select: { id: true, version: true } },
        },
      }),
      this.prisma.heartbeat.findFirst({
        where: { deviceId },
        orderBy: { receivedAt: 'desc' },
      }),
    ]);

    const threshold = new Date(Date.now() - ONLINE_LAST_SEEN_MS);
    const online =
      device.lastSeenAt != null && device.lastSeenAt >= threshold;

    const expectedPublicationVersion =
      state?.currentPublication?.version ?? null;
    const appliedPublicationVersion =
      state?.appliedPublicationVersion ?? null;
    const publicationSynced =
      expectedPublicationVersion == null
        ? appliedPublicationVersion == null
        : appliedPublicationVersion === expectedPublicationVersion;

    return {
      device: maskDevice(device),
      online,
      state: state
        ? {
            lastSyncAt: state.lastSyncAt,
            storageFreeMb: state.storageFreeMb,
            cpuPercent:
              state.cpuPercent != null ? String(state.cpuPercent) : null,
            memoryPercent:
              state.memoryPercent != null ? String(state.memoryPercent) : null,
            networkStatus: state.networkStatus,
            currentPublicationId: state.currentPublicationId,
            expectedPublicationVersion,
            appliedPublicationVersion,
            appliedContentRevision: state.appliedContentRevision,
            appliedAt: state.appliedAt,
            publicationSynced,
            currentItemJson: state.currentItemJson,
            updatedAt: state.updatedAt,
            previewSnapshotAt: state.previewSnapshotAt,
            previewSnapshotKey: state.previewSnapshotKey,
            activeScheduleRuleId: state.activeScheduleRuleId,
            scheduleBaselineItemJson: state.scheduleBaselineItemJson,
          }
        : null,
      lastHeartbeat: lastHeartbeat
        ? {
            receivedAt: lastHeartbeat.receivedAt,
            appVersion: lastHeartbeat.appVersion,
            isOnline: lastHeartbeat.isOnline,
          }
        : null,
    };
  }

  async getById(tenantId: string, id: string) {
    const d = await this.prisma.device.findFirst({
      where: { id, tenantId },
      include: { site: true },
    });
    if (!d) throw new NotFoundException('Dispositivo não encontrado');
    return maskDevice(d);
  }

  async create(tenantId: string, dto: CreateDeviceDto) {
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, tenantId },
    });
    if (!site) throw new NotFoundException('Site não encontrado');

    const pairingCode = generatePairingCode(8);
    const pairingExpiresAt = new Date(Date.now() + PAIRING_TTL_MS);

    const device = await this.prisma.device.create({
      data: {
        tenantId,
        siteId: dto.siteId,
        name: dto.name,
        serialNumber: dto.serialNumber,
        platform: dto.platform ?? 'unknown',
        status: 'provisioned',
        pairingCode,
        pairingExpiresAt,
      },
      include: { site: true },
    });

    return {
      device: maskDevice(device),
      pairingCode,
      pairingExpiresAt,
    };
  }

  async update(tenantId: string, id: string, dto: UpdateDeviceDto) {
    await this.ensureDevice(tenantId, id);
    if (dto.siteId !== undefined) {
      const site = await this.prisma.site.findFirst({
        where: { id: dto.siteId, tenantId },
      });
      if (!site) throw new NotFoundException('Site não encontrado');
    }
    const data: Prisma.DeviceUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.platform !== undefined) data.platform = dto.platform;
    if (dto.siteId !== undefined) {
      data.site = { connect: { id: dto.siteId } };
    }
    if (dto.wakeMac !== undefined) {
      const w = dto.wakeMac.trim();
      if (!w) {
        data.wakeMac = null;
      } else {
        const norm = normalizeWakeMac(w);
        if (!norm) {
          throw new BadRequestException(
            'MAC inválido (use 12 hex, ex.: aa:bb:cc:dd:ee:ff)'
          );
        }
        data.wakeMac = norm;
      }
    }
    if (Object.keys(data).length === 0) {
      const d = await this.prisma.device.findFirst({
        where: { id, tenantId },
        include: { site: true },
      });
      return maskDevice(d!);
    }
    const device = await this.prisma.device.update({
      where: { id },
      data,
      include: { site: true },
    });
    return maskDevice(device);
  }

  async updateViewport(
    tenantId: string,
    id: string,
    dto: UpdateDeviceViewportDto
  ) {
    const existing = await this.ensureDevice(tenantId, id);
    const merged = normalizeDeviceViewport({
      viewportWidth: dto.viewportWidth ?? existing.viewportWidth,
      viewportHeight: dto.viewportHeight ?? existing.viewportHeight,
      displayOrientation:
        dto.displayOrientation ?? existing.displayOrientation,
    });
    const device = await this.prisma.device.update({
      where: { id },
      data: {
        viewportWidth: merged.width,
        viewportHeight: merged.height,
        displayOrientation: merged.orientation,
      },
      include: { site: true },
    });
    return maskDevice(device);
  }

  async remove(tenantId: string, id: string) {
    await this.ensureDevice(tenantId, id);
    await this.prisma.device.delete({ where: { id } });
    return { ok: true };
  }

  async getDeviceLayout(tenantId: string, deviceId: string) {
    await this.ensureDevice(tenantId, deviceId);
    const layout = await this.prisma.deviceLayout.findUnique({
      where: { deviceId },
      include: {
        template: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            zonesJson: true,
          },
        },
      },
    });
    return layout;
  }

  async upsertDeviceLayout(
    tenantId: string,
    deviceId: string,
    dto: UpsertDeviceLayoutDto
  ) {
    const device = await this.ensureDevice(tenantId, deviceId);
    const template = await this.prisma.layoutTemplate.findFirst({
      where: {
        id: dto.templateId,
        OR: [{ tenantId: null }, { tenantId }],
      },
    });
    if (!template) throw new NotFoundException('Template de layout não encontrado');

    const templateZones = template.zonesJson as LayoutTemplateZone[];
    const zonesJson = await this.resolveZoneBindings(
      tenantId,
      templateZones,
      dto.bindings
    );
    const revision = createHash('sha256')
      .update(JSON.stringify({ templateId: dto.templateId, zonesJson }))
      .digest('hex')
      .slice(0, 16);

    const layout = await this.prisma.deviceLayout.upsert({
      where: { deviceId },
      create: {
        tenantId: device.tenantId,
        deviceId,
        templateId: dto.templateId,
        name: dto.name?.trim() || template.name,
        zonesJson: zonesJson as Prisma.InputJsonValue,
        revision,
      },
      update: {
        templateId: dto.templateId,
        name: dto.name?.trim() || template.name,
        zonesJson: zonesJson as Prisma.InputJsonValue,
        revision,
      },
      include: {
        template: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            zonesJson: true,
          },
        },
      },
    });

    return layout;
  }

  /** Monta `current_item_json` com type layout a partir de um DeviceLayout guardado. */
  async buildLayoutCurrentItem(tenantId: string, layoutId: string) {
    const layout = await this.prisma.deviceLayout.findFirst({
      where: { id: layoutId, tenantId },
      include: { template: true, device: true },
    });
    if (!layout) throw new NotFoundException('Layout do dispositivo não encontrado');

    const viewport = normalizeDeviceViewport({
      viewportWidth: layout.device.viewportWidth,
      viewportHeight: layout.device.viewportHeight,
      displayOrientation: layout.device.displayOrientation,
    });
    const templateZones = layout.template.zonesJson as LayoutTemplateZone[];
    const bindings = layout.zonesJson as LayoutZoneBinding[];
    const zones = templateZones
      .map((tz) => {
        const bind = bindings.find((b) => b.zoneId === tz.zoneId);
        if (!bind?.source) return null;
        return {
          zoneId: tz.zoneId,
          frame: bind.frame ?? tz.frame,
          source: bind.source,
          display: normalizeContentDisplay(bind.display),
        };
      })
      .filter((z): z is NonNullable<typeof z> => z != null);

    if (!zones.length) {
      throw new BadRequestException(
        'Layout sem zonas com conteúdo — atribua playlist ou asset a pelo menos uma zona'
      );
    }

    return {
      type: 'layout',
      layoutId: layout.id,
      templateSlug: layout.template.slug,
      revision: layout.revision,
      viewport,
      zones,
    };
  }

  private displayFromDto(dto?: ContentDisplayDto): ContentDisplay | undefined {
    if (!dto) return undefined;
    const normalized = normalizeContentDisplay(dto);
    const hasExtra =
      dto.fit != null ||
      dto.targetWidth != null ||
      dto.targetHeight != null ||
      dto.background != null;
    return hasExtra ? normalized : undefined;
  }

  private bindingDisplayFromDto(
    b: UpsertDeviceLayoutDto['bindings'][number]
  ): ContentDisplay | undefined {
    return this.displayFromDto(b.display);
  }

  private validateZoneFrame(frame: LayoutZoneFrame): void {
    if (frame.unit !== 'percent') {
      throw new BadRequestException('frame.unit deve ser percent');
    }
    if (frame.x + frame.w > 100.01 || frame.y + frame.h > 100.01) {
      throw new BadRequestException('Zona excede os limites do canvas (100%)');
    }
  }

  private bindingFrameFromDto(
    b: UpsertDeviceLayoutDto['bindings'][number]
  ): LayoutZoneFrame | undefined {
    if (!b.frame) return undefined;
    const frame: LayoutZoneFrame = {
      x: b.frame.x,
      y: b.frame.y,
      w: b.frame.w,
      h: b.frame.h,
      unit: 'percent',
    };
    this.validateZoneFrame(frame);
    return frame;
  }

  private async resolveZoneBindings(
    tenantId: string,
    templateZones: LayoutTemplateZone[],
    bindings: UpsertDeviceLayoutDto['bindings']
  ): Promise<LayoutZoneBinding[]> {
    const zoneIds = new Set(templateZones.map((z) => z.zoneId));
    const out: LayoutZoneBinding[] = [];

    for (const b of bindings) {
      if (!zoneIds.has(b.zoneId)) {
        throw new BadRequestException(`Zona desconhecida: ${b.zoneId}`);
      }
      const hasPlaylist = b.playlistId != null && b.playlistId !== '';
      const hasAsset = b.assetId != null && b.assetId !== '';
      const display = this.bindingDisplayFromDto(b);
      const frame = this.bindingFrameFromDto(b);
      const frameExtra = frame ? { frame } : {};
      if (hasPlaylist === hasAsset) {
        out.push({
          zoneId: b.zoneId,
          source: null,
          ...(display ? { display } : {}),
          ...frameExtra,
        });
        continue;
      }
      if (hasPlaylist) {
        const pl = await this.prisma.playlist.findFirst({
          where: { id: b.playlistId, tenantId },
        });
        if (!pl) throw new NotFoundException(`Playlist não encontrada (${b.zoneId})`);
        out.push({
          zoneId: b.zoneId,
          source: { type: 'playlist', playlistId: pl.id },
          ...(display ? { display } : {}),
          ...frameExtra,
        });
      } else {
        const asset = await this.prisma.asset.findFirst({
          where: { id: b.assetId, tenantId },
        });
        if (!asset) throw new NotFoundException(`Asset não encontrado (${b.zoneId})`);
        out.push({
          zoneId: b.zoneId,
          source: { type: 'asset', assetId: asset.id, kind: asset.kind },
          ...(display ? { display } : {}),
          ...frameExtra,
        });
      }
    }

    for (const tz of templateZones) {
      if (!out.some((b) => b.zoneId === tz.zoneId)) {
        out.push({ zoneId: tz.zoneId, source: null });
      }
    }

    return out;
  }

  /** Resolve payload `{ type, assetId | playlistId | layoutId | videoWallId }` e valida tenant. */
  private async resolvePlaybackPayload(
    tenantId: string,
    dto: AssignTestContentDto,
    deviceId?: string
  ): Promise<Record<string, unknown>> {
    const hasAsset = dto.assetId != null && dto.assetId !== '';
    const hasPlaylist = dto.playlistId != null && dto.playlistId !== '';
    const hasLayout = dto.layoutId != null && dto.layoutId !== '';
    const hasWall = dto.videoWallId != null && dto.videoWallId !== '';
    const modes = [hasAsset, hasPlaylist, hasLayout, hasWall].filter(Boolean).length;
    if (modes !== 1) {
      throw new BadRequestException(
        'Informe exatamente um de: assetId, playlistId, layoutId ou videoWallId'
      );
    }

    if (hasLayout) {
      return this.buildLayoutCurrentItem(tenantId, dto.layoutId!);
    }

    if (hasWall) {
      if (!deviceId) {
        throw new BadRequestException('videoWallId requer deviceId no contexto de publicação');
      }
      const item = await this.videoWalls.buildTileCurrentItem(
        tenantId,
        dto.videoWallId!,
        deviceId
      );
      return item as unknown as Record<string, unknown>;
    }

    const display = this.displayFromDto(dto.display);

    if (hasAsset) {
      const asset = await this.prisma.asset.findFirst({
        where: { id: dto.assetId, tenantId },
      });
      if (!asset) throw new NotFoundException('Asset não encontrado');
      return {
        type: 'asset',
        kind: asset.kind,
        assetId: asset.id,
        ...(display ? { display } : {}),
      };
    }
    const playlist = await this.prisma.playlist.findFirst({
      where: { id: dto.playlistId, tenantId },
    });
    if (!playlist) throw new NotFoundException('Playlist não encontrada');
    return {
      type: 'playlist',
      playlistId: playlist.id,
      ...(display ? { display } : {}),
    };
  }

  async assignTestContent(
    tenantId: string,
    deviceId: string,
    dto: AssignTestContentDto
  ) {
    const device = await this.ensureDevice(tenantId, deviceId);
    const currentItem = await this.resolvePlaybackPayload(tenantId, dto, deviceId);

    const itemJson = currentItem as Prisma.InputJsonValue;
    await this.prisma.deviceState.upsert({
      where: { deviceId },
      create: {
        deviceId,
        tenantId: device.tenantId,
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

    return { ok: true, currentItem };
  }

  /** Publicação versionada: grava histórico e define a publicação ativa no device_state. */
  async publishContent(
    tenantId: string,
    deviceId: string,
    dto: PublishDeviceDto
  ) {
    const device = await this.ensureDevice(tenantId, deviceId);
    const currentItem = await this.resolvePlaybackPayload(tenantId, dto, deviceId);

    const result = await this.prisma.$transaction(async (tx) => {
      const agg = await tx.publication.aggregate({
        where: { deviceId },
        _max: { version: true },
      });
      const nextVersion = (agg._max.version ?? 0) + 1;

      const pub = await tx.publication.create({
        data: {
          tenantId: device.tenantId,
          deviceId,
          version: nextVersion,
          label: dto.label?.trim() || null,
          payloadJson: currentItem as Prisma.InputJsonValue,
        },
      });

      const itemJson = currentItem as Prisma.InputJsonValue;
      await tx.deviceState.upsert({
        where: { deviceId },
        create: {
          deviceId,
          tenantId: device.tenantId,
          currentPublicationId: pub.id,
          currentItemJson: itemJson,
          scheduleBaselineItemJson: itemJson,
          activeScheduleRuleId: null,
          lastSyncAt: new Date(),
          appliedPublicationVersion: null,
          appliedContentRevision: null,
          appliedAt: null,
        },
        update: {
          currentPublicationId: pub.id,
          currentItemJson: itemJson,
          scheduleBaselineItemJson: itemJson,
          activeScheduleRuleId: null,
          lastSyncAt: new Date(),
          appliedPublicationVersion: null,
          appliedContentRevision: null,
          appliedAt: null,
        },
      });

      return { publicationId: pub.id, version: pub.version, currentItem };
    });

    return { ok: true, ...result };
  }

  async listPublications(tenantId: string, deviceId: string) {
    await this.ensureDevice(tenantId, deviceId);
    const rows = await this.prisma.publication.findMany({
      where: { deviceId, tenantId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        label: true,
        payloadJson: true,
        createdAt: true,
      },
    });
    return rows;
  }

  async regeneratePairing(tenantId: string, id: string) {
    const existing = await this.ensureDevice(tenantId, id);
    if (existing.status === 'active') {
      await this.prisma.device.update({
        where: { id },
        data: { authTokenHash: null },
      });
    }
    const pairingCode = generatePairingCode(8);
    const pairingExpiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    const device = await this.prisma.device.update({
      where: { id },
      data: {
        pairingCode,
        pairingExpiresAt,
        status: 'provisioned',
        authTokenHash: null,
      },
      include: { site: true },
    });
    return {
      device: maskDevice(device),
      pairingCode,
      pairingExpiresAt,
    };
  }

  private async ensureDevice(tenantId: string, id: string) {
    const d = await this.prisma.device.findFirst({ where: { id, tenantId } });
    if (!d) throw new NotFoundException('Dispositivo não encontrado');
    return d;
  }

  async pair(dto: {
    pairingCode: string;
    name?: string;
    platform: string;
    runtimeVersion?: string;
  }) {
    const device = await this.prisma.device.findFirst({
      where: {
        pairingCode: dto.pairingCode.trim().toUpperCase(),
        status: 'provisioned',
        pairingExpiresAt: { gt: new Date() },
      },
      include: { site: true },
    });
    if (!device) {
      throw new BadRequestException('Código inválido ou expirado');
    }

    const rawToken = generateDeviceToken();
    const tokenHash = hashToken(rawToken);

    const updated = await this.prisma.device.update({
      where: { id: device.id },
      data: {
        authTokenHash: tokenHash,
        pairingCode: null,
        pairingExpiresAt: null,
        status: 'active',
        platform: dto.platform || device.platform,
        name: dto.name?.trim() ? dto.name.trim() : device.name,
        runtimeVersion: dto.runtimeVersion ?? device.runtimeVersion,
        lastSeenAt: new Date(),
      },
      include: { site: true },
    });

    await this.prisma.deviceState.upsert({
      where: { deviceId: updated.id },
      create: {
        deviceId: updated.id,
        tenantId: updated.tenantId,
      },
      update: {},
    });

    return {
      accessToken: rawToken,
      tokenType: 'Bearer' as const,
      deviceId: updated.id,
      siteId: updated.siteId,
      name: updated.name,
    };
  }
}
