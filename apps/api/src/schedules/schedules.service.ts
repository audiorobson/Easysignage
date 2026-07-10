import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DevicesService } from '../devices/devices.service';
import { VideoWallsService } from '../video-walls/video-walls.service';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { UpdateScheduleRuleDto } from './dto/update-schedule-rule.dto';
import { ScheduleEngineService } from './schedule-engine.service';
import { LicenseService } from '../license/license.service';

function assertTimeRange(startMin: number, endMin: number) {
  if (startMin < 0 || startMin > 1439) {
    throw new BadRequestException('startMin deve estar entre 0 e 1439');
  }
  if (endMin < 1 || endMin > 1440) {
    throw new BadRequestException('endMin deve estar entre 1 e 1440');
  }
  if (startMin >= endMin) {
    throw new BadRequestException('startMin deve ser menor que endMin');
  }
}

export type ScheduleContentPayload = {
  playlistId: string | null;
  layoutId: string | null;
  videoWallId: string | null;
};

function resolveContentPayload(dto: {
  playlistId?: string | null;
  layoutId?: string | null;
  videoWallId?: string | null;
}): ScheduleContentPayload {
  const hasPlaylist = dto.playlistId != null && dto.playlistId !== '';
  const hasLayout = dto.layoutId != null && dto.layoutId !== '';
  const hasWall = dto.videoWallId != null && dto.videoWallId !== '';
  const modes = [hasPlaylist, hasLayout, hasWall].filter(Boolean).length;
  if (modes !== 1) {
    throw new BadRequestException(
      'Informe exatamente um de: playlistId, layoutId ou videoWallId'
    );
  }
  return {
    playlistId: hasPlaylist ? dto.playlistId! : null,
    layoutId: hasLayout ? dto.layoutId! : null,
    videoWallId: hasWall ? dto.videoWallId! : null,
  };
}

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleEngine: ScheduleEngineService,
    private readonly devices: DevicesService,
    private readonly videoWalls: VideoWallsService,
    private readonly license: LicenseService
  ) {}

  private async assertContentLicensed(content: ScheduleContentPayload) {
    if (content.videoWallId) {
      await this.license.assertFeature('video_walls');
    }
  }

  async list(tenantId: string) {
    const rows = await this.prisma.scheduleRule.findMany({
      where: { tenantId },
      orderBy: [{ priority: 'desc' }, { dayOfWeek: 'asc' }, { startMin: 'asc' }],
      include: {
        playlist: { select: { id: true, name: true } },
        layout: {
          select: {
            id: true,
            name: true,
            template: { select: { slug: true, name: true } },
          },
        },
        videoWall: { select: { id: true, name: true } },
        device: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
    });
    return rows.map((r) => this.toRow(r));
  }

  async getById(tenantId: string, id: string) {
    const r = await this.prisma.scheduleRule.findFirst({
      where: { id, tenantId },
      include: {
        playlist: { select: { id: true, name: true } },
        layout: {
          select: {
            id: true,
            name: true,
            template: { select: { slug: true, name: true } },
          },
        },
        videoWall: { select: { id: true, name: true } },
        device: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
    });
    if (!r) throw new NotFoundException('Regra não encontrada');
    return this.toRow(r);
  }

  async create(tenantId: string, dto: CreateScheduleRuleDto) {
    this.assertScope(dto.scope, dto.deviceId, dto.groupId);
    assertTimeRange(dto.startMin, dto.endMin);
    const content = resolveContentPayload(dto);
    await this.assertContentLicensed(content);
    await this.ensureContentRefs(
      tenantId,
      content,
      dto.scope,
      dto.deviceId,
      dto.groupId
    );

    const row = await this.prisma.scheduleRule.create({
      data: {
        tenantId,
        name: dto.name?.trim() || null,
        playlistId: content.playlistId,
        layoutId: content.layoutId,
        videoWallId: content.videoWallId,
        scope: dto.scope,
        deviceId: dto.scope === 'device' ? dto.deviceId! : null,
        groupId: dto.scope === 'group' ? dto.groupId! : null,
        dayOfWeek: dto.dayOfWeek,
        startMin: dto.startMin,
        endMin: dto.endMin,
        priority: dto.priority ?? 0,
        enabled: dto.enabled ?? true,
      },
      include: this.ruleInclude(),
    });
    const out = this.toRow(row);
    await this.scheduleEngine.applyForRuleScope(
      tenantId,
      row.scope as 'device' | 'group',
      row.deviceId,
      row.groupId
    );
    return out;
  }

  async update(tenantId: string, id: string, dto: UpdateScheduleRuleDto) {
    const existing = await this.prisma.scheduleRule.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Regra não encontrada');

    const scope = (dto.scope ?? existing.scope) as 'device' | 'group';

    let deviceId: string | null;
    let groupId: string | null;
    if (scope === 'device') {
      groupId = null;
      deviceId =
        dto.deviceId !== undefined
          ? dto.deviceId
          : existing.scope === 'device'
            ? existing.deviceId
            : null;
    } else {
      deviceId = null;
      groupId =
        dto.groupId !== undefined
          ? dto.groupId
          : existing.scope === 'group'
            ? existing.groupId
            : null;
    }

    this.assertScope(scope, deviceId ?? undefined, groupId ?? undefined);

    const content = resolveContentPayload({
      playlistId:
        dto.playlistId !== undefined ? dto.playlistId : existing.playlistId,
      layoutId: dto.layoutId !== undefined ? dto.layoutId : existing.layoutId,
      videoWallId:
        dto.videoWallId !== undefined
          ? dto.videoWallId
          : existing.videoWallId,
    });

    await this.assertContentLicensed(content);

    await this.ensureContentRefs(
      tenantId,
      content,
      scope,
      deviceId ?? undefined,
      groupId ?? undefined
    );

    const startMin = dto.startMin ?? existing.startMin;
    const endMin = dto.endMin ?? existing.endMin;
    if (dto.startMin != null || dto.endMin != null) {
      assertTimeRange(startMin, endMin);
    }

    const row = await this.prisma.scheduleRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined
          ? { name: dto.name === null ? null : dto.name.trim() || null }
          : {}),
        playlistId: content.playlistId,
        layoutId: content.layoutId,
        videoWallId: content.videoWallId,
        scope,
        deviceId,
        groupId,
        ...(dto.dayOfWeek != null ? { dayOfWeek: dto.dayOfWeek } : {}),
        ...(dto.startMin != null ? { startMin: dto.startMin } : {}),
        ...(dto.endMin != null ? { endMin: dto.endMin } : {}),
        ...(dto.priority != null ? { priority: dto.priority } : {}),
        ...(dto.enabled != null ? { enabled: dto.enabled } : {}),
      },
      include: this.ruleInclude(),
    });

    const out = this.toRow(row);
    await this.scheduleEngine.applyForRuleScope(
      tenantId,
      row.scope as 'device' | 'group',
      row.deviceId,
      row.groupId
    );
    if (
      existing.scope !== row.scope ||
      existing.deviceId !== row.deviceId ||
      existing.groupId !== row.groupId
    ) {
      await this.scheduleEngine.applyForRuleScope(
        tenantId,
        existing.scope as 'device' | 'group',
        existing.deviceId,
        existing.groupId
      );
    }
    return out;
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.scheduleRule.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Regra não encontrada');
    await this.prisma.scheduleRule.delete({ where: { id } });
    await this.scheduleEngine.applyForRuleScope(
      tenantId,
      existing.scope as 'device' | 'group',
      existing.deviceId,
      existing.groupId
    );
  }

  async reapplyAll(tenantId: string) {
    const devices = await this.prisma.device.findMany({
      where: { tenantId },
      select: { id: true },
    });
    await this.scheduleEngine.applyForDevices(
      tenantId,
      devices.map((d) => d.id)
    );
    return { ok: true, devices: devices.length };
  }

  private ruleInclude() {
    return {
      playlist: { select: { id: true, name: true } },
      layout: {
        select: {
          id: true,
          name: true,
          template: { select: { slug: true, name: true } },
        },
      },
      videoWall: { select: { id: true, name: true } },
      device: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
    } as const;
  }

  private assertScope(
    scope: 'device' | 'group',
    deviceId?: string,
    groupId?: string
  ) {
    if (scope === 'device') {
      if (!deviceId) {
        throw new BadRequestException('deviceId é obrigatório quando scope=device');
      }
    } else {
      if (!groupId) {
        throw new BadRequestException('groupId é obrigatório quando scope=group');
      }
    }
  }

  private async ensureContentRefs(
    tenantId: string,
    content: ScheduleContentPayload,
    scope: 'device' | 'group',
    deviceId?: string,
    groupId?: string
  ) {
    if (scope === 'device' && deviceId) {
      const d = await this.prisma.device.findFirst({
        where: { id: deviceId, tenantId },
      });
      if (!d) throw new BadRequestException('Device inválido');
    }
    if (scope === 'group' && groupId) {
      const g = await this.prisma.deviceGroup.findFirst({
        where: { id: groupId, tenantId },
      });
      if (!g) throw new BadRequestException('Grupo inválido');
    }

    if (content.playlistId) {
      const pl = await this.prisma.playlist.findFirst({
        where: { id: content.playlistId, tenantId },
      });
      if (!pl) throw new BadRequestException('Playlist inválida');
      return;
    }

    if (content.layoutId) {
      if (scope !== 'device' || !deviceId) {
        throw new BadRequestException(
          'layoutId só é suportado em regras com scope=device'
        );
      }
      const layout = await this.prisma.deviceLayout.findFirst({
        where: { id: content.layoutId, tenantId, deviceId },
      });
      if (!layout) {
        throw new BadRequestException(
          'Layout inválido ou não pertence a este device'
        );
      }
      try {
        await this.devices.buildLayoutCurrentItem(tenantId, content.layoutId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Layout sem conteúdo';
        throw new BadRequestException(msg);
      }
      return;
    }

    if (content.videoWallId) {
      const wall = await this.prisma.videoWall.findFirst({
        where: { id: content.videoWallId, tenantId },
      });
      if (!wall) throw new BadRequestException('Video wall inválida');
      if (!wall.playlistId) {
        throw new BadRequestException('Video wall sem playlist definida');
      }
      if (scope === 'device' && deviceId) {
        const tile = await this.prisma.videoWallTile.findFirst({
          where: { wallId: content.videoWallId, deviceId },
        });
        if (!tile) {
          throw new BadRequestException(
            'Device não é tile desta video wall'
          );
        }
      }
    }
  }

  private toRow(r: {
    id: string;
    tenantId: string;
    name: string | null;
    playlistId: string | null;
    layoutId: string | null;
    videoWallId: string | null;
    scope: string;
    deviceId: string | null;
    groupId: string | null;
    dayOfWeek: number;
    startMin: number;
    endMin: number;
    priority: number;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
    playlist: { id: string; name: string } | null;
    layout: {
      id: string;
      name: string | null;
      template: { slug: string; name: string };
    } | null;
    videoWall: { id: string; name: string } | null;
    device: { id: string; name: string } | null;
    group: { id: string; name: string } | null;
  }) {
    const targetLabel =
      r.scope === 'device' && r.device
        ? `Device: ${r.device.name}`
        : r.scope === 'group' && r.group
          ? `Grupo: ${r.group.name}`
          : r.scope === 'device'
            ? 'Device'
            : 'Grupo';

    let contentType: 'playlist' | 'layout' | 'video_wall' = 'playlist';
    let contentLabel = r.playlist?.name ?? '—';
    if (r.layoutId && r.layout) {
      contentType = 'layout';
      contentLabel =
        r.layout.name?.trim() ||
        `${r.layout.template.name} (${r.layout.template.slug})`;
    } else if (r.videoWallId && r.videoWall) {
      contentType = 'video_wall';
      contentLabel = r.videoWall.name;
    }

    return {
      id: r.id,
      name: r.name,
      playlistId: r.playlistId,
      layoutId: r.layoutId,
      videoWallId: r.videoWallId,
      contentType,
      contentLabel,
      playlist: r.playlist,
      layout: r.layout,
      videoWall: r.videoWall,
      scope: r.scope as 'device' | 'group',
      deviceId: r.deviceId,
      groupId: r.groupId,
      device: r.device,
      group: r.group,
      targetLabel,
      dayOfWeek: r.dayOfWeek,
      startMin: r.startMin,
      endMin: r.endMin,
      priority: r.priority,
      enabled: r.enabled,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
