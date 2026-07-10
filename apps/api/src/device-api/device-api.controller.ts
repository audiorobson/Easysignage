import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '../generated/prisma-client';
import { AssetsService } from '../assets/assets.service';
import { PlaylistsService } from '../playlists/playlists.service';
import { DeviceAuthGuard } from '../common/guards/device-auth.guard';
import {
  CurrentDevice,
  DeviceWithSite,
} from '../common/decorators/current-device.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleEngineService } from '../schedules/schedule-engine.service';
import { AlertsService } from '../alerts/alerts.service';
import { DevicePreviewService } from '../telemetry/device-preview.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import {
  DeviceCommandAckDto,
  TelemetryBatchDto,
} from '../telemetry/dto/telemetry-batch.dto';
import { computeContentRevision } from './content-revision';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { normalizeDeviceViewport } from '@easysignage/shared-types';

@ApiTags('device')
@ApiBearerAuth('device-token')
@Controller('device')
@UseGuards(DeviceAuthGuard)
export class DeviceApiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly playlists: PlaylistsService,
    private readonly telemetry: TelemetryService,
    private readonly devicePreview: DevicePreviewService,
    private readonly scheduleEngine: ScheduleEngineService,
    private readonly alerts: AlertsService
  ) {}

  /**
   * Telemetria agregada + eventos (rede, playback, falhas).
   * Canais futuros: o mesmo token device; WebSocket pode substituir ou complementar o POST.
   */
  @Post('telemetry')
  async postTelemetry(
    @CurrentDevice() device: DeviceWithSite,
    @Body() body: TelemetryBatchDto
  ) {
    return this.telemetry.ingestFromDevice(device.tenantId, device.id, body);
  }

  /** Pré-visualização JPEG/PNG (~1 fps) enviada pelo player para o CMS (sem WebRTC). */
  @Post('preview')
  @ApiConsumes('multipart/form-data')
  async postPreview(
    @CurrentDevice() device: DeviceWithSite,
    @Req() req: FastifyRequest
  ) {
    return this.devicePreview.saveFromMultipart(
      device.tenantId,
      device.id,
      req
    );
  }

  /** Fila servidor → player (WOL, GPIO, HTTP, …). O player deve fazer polling ou canal em tempo real. */
  @Get('commands/pending')
  async pendingCommands(@CurrentDevice() device: DeviceWithSite) {
    const commands = await this.telemetry.pollPendingCommands(
      device.tenantId,
      device.id
    );
    return { commands };
  }

  @Post('commands/:commandId/ack')
  async ackCommand(
    @CurrentDevice() device: DeviceWithSite,
    @Param('commandId', ParseUUIDPipe) commandId: string,
    @Body() body: DeviceCommandAckDto
  ) {
    const ok = body.status !== 'failed';
    return this.telemetry.ackCommand(
      device.tenantId,
      device.id,
      commandId,
      ok,
      body.result
    );
  }

  @Post('heartbeat')
  async heartbeat(
    @CurrentDevice() device: DeviceWithSite,
    @Body() body: HeartbeatDto
  ) {
    await this.scheduleEngine.applyForDevice(device.tenantId, device.id);

    const appVersion =
      body.appVersion?.trim() ||
      body.publicationVersion?.trim() ||
      undefined;

    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        ...(appVersion ? { runtimeVersion: appVersion } : {}),
      },
    });

    await this.prisma.heartbeat.create({
      data: {
        tenantId: device.tenantId,
        deviceId: device.id,
        isOnline: true,
        appVersion,
        metricsJson: body.metrics
          ? (body.metrics as Prisma.InputJsonValue)
          : undefined,
      },
    });

    if (body.playbackSync?.wallId) {
      const ps = body.playbackSync;
      const existing = await this.prisma.deviceState.findUnique({
        where: { deviceId: device.id },
        select: { telemetrySnapshotJson: true },
      });
      const prev =
        (existing?.telemetrySnapshotJson as Record<string, unknown> | null) ?? {};
      const wallSync = {
        wallId: ps.wallId,
        itemIndex: ps.itemIndex ?? 0,
        positionMs: ps.positionMs ?? 0,
        driftMs: ps.driftMs ?? 0,
        ...(ps.syncEpochMs != null ? { syncEpochMs: ps.syncEpochMs } : {}),
        reportedAt: new Date().toISOString(),
      };
      const snap = {
        ...prev,
        wallSync,
        playbackSync: wallSync,
      } as Prisma.InputJsonValue;
      await this.prisma.deviceState.upsert({
        where: { deviceId: device.id },
        create: {
          deviceId: device.id,
          tenantId: device.tenantId,
          telemetrySnapshotJson: snap,
          telemetryUpdatedAt: new Date(),
        },
        update: {
          telemetrySnapshotJson: snap,
          telemetryUpdatedAt: new Date(),
        },
      });
    }

    if (
      body.appliedPublicationVersion != null ||
      (body.appliedContentRevision != null &&
        body.appliedContentRevision.trim() !== '')
    ) {
      const state = await this.prisma.deviceState.findUnique({
        where: { deviceId: device.id },
        include: { currentPublication: { select: { version: true } } },
      });
      const expectedVersion = state?.currentPublication?.version ?? null;
      const ackVersion = body.appliedPublicationVersion ?? null;
      const ackRevision = body.appliedContentRevision?.trim() || null;

      const versionOk =
        expectedVersion == null ||
        ackVersion == null ||
        ackVersion === expectedVersion;

      if (versionOk) {
        await this.prisma.deviceState.update({
          where: { deviceId: device.id },
          data: {
            ...(ackVersion != null
              ? { appliedPublicationVersion: ackVersion }
              : {}),
            ...(ackRevision != null
              ? { appliedContentRevision: ackRevision }
              : {}),
            appliedAt: new Date(),
          },
        });
      }
    }

    await this.alerts.evaluateDevice(device.tenantId, device.id);

    return { ok: true, serverTime: new Date().toISOString() };
  }

  @Get('state')
  async state(@CurrentDevice() device: DeviceWithSite) {
    await this.scheduleEngine.applyForDevice(device.tenantId, device.id);

    /** Presença leve: state poll (3s) mantém «online» no CMS sem esperar heartbeat (60s). */
    const presenceStaleMs = 30_000;
    const lastSeen = device.lastSeenAt?.getTime() ?? 0;
    if (Date.now() - lastSeen > presenceStaleMs) {
      await this.prisma.device.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      });
    }

    const row = await this.prisma.deviceState.findUnique({
      where: { deviceId: device.id },
      include: {
        currentPublication: { select: { id: true, version: true } },
      },
    });

    let playlistStamp = '';
    const item = row?.currentItemJson as Record<string, unknown> | null;
    playlistStamp = await this.resolvePlaylistStamp(device.tenantId, item);

    return {
      deviceId: device.id,
      viewport: normalizeDeviceViewport({
        viewportWidth: device.viewportWidth,
        viewportHeight: device.viewportHeight,
        displayOrientation: device.displayOrientation,
      }),
      currentPublicationId: row?.currentPublicationId ?? null,
      publicationVersion: row?.currentPublication?.version ?? null,
      lastSyncAt: row?.lastSyncAt ?? null,
      contentRevision: computeContentRevision(row, playlistStamp),
      currentItem: row?.currentItemJson ?? null,
    };
  }

  @Get('playlists/:playlistId/manifest')
  async playlistManifest(
    @CurrentDevice() device: DeviceWithSite,
    @Param('playlistId', ParseUUIDPipe) playlistId: string
  ) {
    return this.playlists.getManifestForDevice(device.tenantId, playlistId);
  }

  /** Metadados do asset (kind, URL remota) — sem binário. */
  @Get('assets/:assetId/meta')
  async assetMeta(
    @CurrentDevice() device: DeviceWithSite,
    @Param('assetId', ParseUUIDPipe) assetId: string
  ) {
    return this.assets.getMetaForTenant(device.tenantId, assetId);
  }

  /** Stream do ficheiro ou redirecionamento 302 para URL externa. */
  @Get('assets/:assetId/file')
  async assetFile(
    @CurrentDevice() device: DeviceWithSite,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Res({ passthrough: false }) reply: FastifyReply
  ) {
    await this.assets.sendFileForDevice(device.tenantId, assetId, reply);
  }

  private async resolvePlaylistStamp(
    tenantId: string,
    item: Record<string, unknown> | null
  ): Promise<string> {
    if (!item) return '';
    if (item['type'] === 'playlist' && typeof item['playlistId'] === 'string') {
      const pl = await this.prisma.playlist.findFirst({
        where: { id: item['playlistId'], tenantId },
        select: { updatedAt: true },
      });
      return pl?.updatedAt.toISOString() ?? '';
    }
    if (item['type'] === 'layout' && Array.isArray(item['zones'])) {
      const ids = new Set<string>();
      for (const raw of item['zones']) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const src = (raw as Record<string, unknown>)['source'];
        if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
        const s = src as Record<string, unknown>;
        if (s['type'] === 'playlist' && typeof s['playlistId'] === 'string') {
          ids.add(s['playlistId']);
        }
      }
      if (!ids.size) {
        return typeof item['revision'] === 'string' ? item['revision'] : '';
      }
      const rows = await this.prisma.playlist.findMany({
        where: { tenantId, id: { in: [...ids] } },
        select: { id: true, updatedAt: true },
        orderBy: { id: 'asc' },
      });
      return rows.map((r) => `${r.id}:${r.updatedAt.toISOString()}`).join('|');
    }
    if (item['type'] === 'wall_tile') {
      const wallId = typeof item['wallId'] === 'string' ? item['wallId'] : '';
      const revision =
        typeof item['wallRevision'] === 'string' ? item['wallRevision'] : '';
      const sync = item['sync'];
      let epoch = '';
      if (sync && typeof sync === 'object' && !Array.isArray(sync)) {
        const e = (sync as Record<string, unknown>)['epochMs'];
        if (typeof e === 'number') epoch = String(e);
      }
      const src = item['source'];
      if (src && typeof src === 'object' && !Array.isArray(src)) {
        const s = src as Record<string, unknown>;
        if (s['type'] === 'playlist' && typeof s['playlistId'] === 'string') {
          const pl = await this.prisma.playlist.findFirst({
            where: { id: s['playlistId'], tenantId },
            select: { updatedAt: true },
          });
          return `${wallId}:${revision}:${epoch}:${pl?.updatedAt.toISOString() ?? ''}`;
        }
      }
      return `${wallId}:${revision}:${epoch}`;
    }
    return '';
  }
}
