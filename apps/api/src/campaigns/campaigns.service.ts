import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CAMPAIGN_SCOPES,
  CAMPAIGN_STATUSES,
  campaignScopeLabelPt,
  campaignStatusLabelPt,
} from '@easysignage/shared-types';
import { ScheduleEngineService } from '../schedules/schedule-engine.service';
import { CampaignEngineService } from './campaign-engine.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

function assertScope(
  scope: string,
  deviceId?: string | null,
  groupId?: string | null,
  siteId?: string | null
) {
  if (!CAMPAIGN_SCOPES.includes(scope as (typeof CAMPAIGN_SCOPES)[number])) {
    throw new BadRequestException('scope inválido');
  }
  if (scope === 'device' && !deviceId) {
    throw new BadRequestException('deviceId obrigatório para scope=device');
  }
  if (scope === 'group' && !groupId) {
    throw new BadRequestException('groupId obrigatório para scope=group');
  }
  if (scope === 'site' && !siteId) {
    throw new BadRequestException('siteId obrigatório para scope=site');
  }
  if (scope === 'all' && (deviceId || groupId || siteId)) {
    throw new BadRequestException('scope=all não aceita alvo específico');
  }
}

function assertTimeWindow(
  dayOfWeek?: number | null,
  startMin?: number | null,
  endMin?: number | null
) {
  const hasDay = dayOfWeek != null;
  const hasStart = startMin != null;
  const hasEnd = endMin != null;
  if (!hasDay && !hasStart && !hasEnd) return;
  if (hasStart !== hasEnd) {
    throw new BadRequestException('Informe startMin e endMin em conjunto');
  }
  if (startMin! >= endMin!) {
    throw new BadRequestException('startMin deve ser menor que endMin');
  }
}

function parseOptionalDate(v?: string | null): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Data inválida');
  }
  return d;
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignEngine: CampaignEngineService,
    @Inject(forwardRef(() => ScheduleEngineService))
    private readonly scheduleEngine: ScheduleEngineService
  ) {}

  async list(tenantId: string) {
    const rows = await this.prisma.campaign.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
      include: {
        playlist: { select: { id: true, name: true } },
        device: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
    });
    return rows.map((r) => this.toRow(r));
  }

  async getById(tenantId: string, id: string) {
    const r = await this.prisma.campaign.findFirst({
      where: { id, tenantId },
      include: {
        playlist: { select: { id: true, name: true } },
        device: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
    });
    if (!r) throw new NotFoundException('Campanha não encontrada');
    return this.toRow(r);
  }

  async create(tenantId: string, userId: string, dto: CreateCampaignDto) {
    assertScope(dto.scope, dto.deviceId, dto.groupId, dto.siteId);
    assertTimeWindow(dto.dayOfWeek, dto.startMin, dto.endMin);
    const startAt = parseOptionalDate(dto.startAt);
    const endAt = parseOptionalDate(dto.endAt);
    if (startAt && endAt && startAt >= endAt) {
      throw new BadRequestException('startAt deve ser anterior a endAt');
    }
    await this.ensurePlaylist(tenantId, dto.playlistId);
    await this.ensureScopeRefs(tenantId, dto.scope, dto.deviceId, dto.groupId, dto.siteId);

    const row = await this.prisma.campaign.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        playlistId: dto.playlistId,
        priority: dto.priority ?? 10,
        status: 'draft',
        scope: dto.scope,
        deviceId: dto.scope === 'device' ? dto.deviceId! : null,
        groupId: dto.scope === 'group' ? dto.groupId! : null,
        siteId: dto.scope === 'site' ? dto.siteId! : null,
        startAt: startAt ?? null,
        endAt: endAt ?? null,
        dayOfWeek: dto.dayOfWeek ?? null,
        startMin: dto.startMin ?? null,
        endMin: dto.endMin ?? null,
        createdById: userId,
      },
      include: {
        playlist: { select: { id: true, name: true } },
        device: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
    });
    return this.toRow(row);
  }

  async update(tenantId: string, id: string, dto: UpdateCampaignDto) {
    const existing = await this.prisma.campaign.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Campanha não encontrada');

    const scope = dto.scope ?? existing.scope;
    const deviceId =
      dto.deviceId !== undefined ? dto.deviceId : existing.deviceId;
    const groupId =
      dto.groupId !== undefined ? dto.groupId : existing.groupId;
    const siteId = dto.siteId !== undefined ? dto.siteId : existing.siteId;
    assertScope(scope, deviceId, groupId, siteId);

    const dayOfWeek =
      dto.dayOfWeek !== undefined ? dto.dayOfWeek : existing.dayOfWeek;
    const startMin =
      dto.startMin !== undefined ? dto.startMin : existing.startMin;
    const endMin = dto.endMin !== undefined ? dto.endMin : existing.endMin;
    assertTimeWindow(dayOfWeek, startMin, endMin);

    if (dto.playlistId) await this.ensurePlaylist(tenantId, dto.playlistId);
    await this.ensureScopeRefs(tenantId, scope, deviceId, groupId, siteId);

    const startAt = parseOptionalDate(dto.startAt);
    const endAt = parseOptionalDate(dto.endAt);
    const nextStart = startAt !== undefined ? startAt : existing.startAt;
    const nextEnd = endAt !== undefined ? endAt : existing.endAt;
    if (nextStart && nextEnd && nextStart >= nextEnd) {
      throw new BadRequestException('startAt deve ser anterior a endAt');
    }

    if (dto.status && !CAMPAIGN_STATUSES.includes(dto.status as never)) {
      throw new BadRequestException('status inválido');
    }

    const row = await this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.playlistId != null ? { playlistId: dto.playlistId } : {}),
        ...(dto.priority != null ? { priority: dto.priority } : {}),
        ...(dto.status != null ? { status: dto.status } : {}),
        scope,
        deviceId: scope === 'device' ? deviceId : null,
        groupId: scope === 'group' ? groupId : null,
        siteId: scope === 'site' ? siteId : null,
        ...(startAt !== undefined ? { startAt } : {}),
        ...(endAt !== undefined ? { endAt } : {}),
        ...(dto.dayOfWeek !== undefined ? { dayOfWeek: dto.dayOfWeek } : {}),
        ...(dto.startMin !== undefined ? { startMin: dto.startMin } : {}),
        ...(dto.endMin !== undefined ? { endMin: dto.endMin } : {}),
      },
      include: {
        playlist: { select: { id: true, name: true } },
        device: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
    });

    await this.reapplyScope(
      tenantId,
      existing.scope,
      existing.deviceId,
      existing.groupId,
      existing.siteId
    );
    await this.reapplyScope(tenantId, row.scope, row.deviceId, row.groupId, row.siteId);

    return this.toRow(row);
  }

  async setStatus(tenantId: string, id: string, status: string) {
    if (!CAMPAIGN_STATUSES.includes(status as never)) {
      throw new BadRequestException('status inválido');
    }
    const existing = await this.prisma.campaign.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Campanha não encontrada');

    const row = await this.prisma.campaign.update({
      where: { id },
      data: { status },
      include: {
        playlist: { select: { id: true, name: true } },
        device: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
    });

    await this.reapplyScope(
      tenantId,
      row.scope,
      row.deviceId,
      row.groupId,
      row.siteId
    );

    return this.toRow(row);
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.campaign.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Campanha não encontrada');

    await this.prisma.campaign.delete({ where: { id } });

    await this.reapplyScope(
      tenantId,
      existing.scope,
      existing.deviceId,
      existing.groupId,
      existing.siteId
    );
  }

  async reapplyAll(tenantId: string) {
    const devices = await this.prisma.device.findMany({
      where: { tenantId },
      select: { id: true },
    });
    for (const d of devices) {
      await this.scheduleEngine.applyForDevice(tenantId, d.id);
    }
    return { reapplied: devices.length };
  }

  private async reapplyScope(
    tenantId: string,
    scope: string,
    deviceId: string | null,
    groupId: string | null,
    siteId: string | null
  ) {
    const ids = await this.campaignEngine.resolveDeviceIdsForScope(
      tenantId,
      scope,
      deviceId,
      groupId,
      siteId
    );
    for (const id of ids) {
      await this.scheduleEngine.applyForDevice(tenantId, id);
    }
  }

  private async ensurePlaylist(tenantId: string, playlistId: string) {
    const pl = await this.prisma.playlist.findFirst({
      where: { id: playlistId, tenantId },
    });
    if (!pl) throw new NotFoundException('Playlist não encontrada');
  }

  private async ensureScopeRefs(
    tenantId: string,
    scope: string,
    deviceId?: string | null,
    groupId?: string | null,
    siteId?: string | null
  ) {
    if (scope === 'device' && deviceId) {
      const d = await this.prisma.device.findFirst({
        where: { id: deviceId, tenantId },
      });
      if (!d) throw new NotFoundException('Device não encontrado');
    }
    if (scope === 'group' && groupId) {
      const g = await this.prisma.deviceGroup.findFirst({
        where: { id: groupId, tenantId },
      });
      if (!g) throw new NotFoundException('Grupo não encontrado');
    }
    if (scope === 'site' && siteId) {
      const s = await this.prisma.site.findFirst({
        where: { id: siteId, tenantId },
      });
      if (!s) throw new NotFoundException('Site não encontrado');
    }
  }

  private toRow(
    r: {
      id: string;
      name: string;
      description: string | null;
      playlistId: string;
      priority: number;
      status: string;
      scope: string;
      deviceId: string | null;
      groupId: string | null;
      siteId: string | null;
      startAt: Date | null;
      endAt: Date | null;
      dayOfWeek: number | null;
      startMin: number | null;
      endMin: number | null;
      createdAt: Date;
      updatedAt: Date;
      playlist: { id: string; name: string };
      device: { id: string; name: string } | null;
      group: { id: string; name: string } | null;
      site: { id: string; name: string } | null;
    }
  ) {
    let targetLabel = campaignScopeLabelPt(r.scope);
    if (r.scope === 'device' && r.device) targetLabel = r.device.name;
    if (r.scope === 'group' && r.group) targetLabel = r.group.name;
    if (r.scope === 'site' && r.site) targetLabel = r.site.name;

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      playlistId: r.playlistId,
      playlist: r.playlist,
      priority: r.priority,
      status: r.status,
      statusLabel: campaignStatusLabelPt(r.status),
      scope: r.scope,
      scopeLabel: campaignScopeLabelPt(r.scope),
      deviceId: r.deviceId,
      groupId: r.groupId,
      siteId: r.siteId,
      targetLabel,
      startAt: r.startAt?.toISOString() ?? null,
      endAt: r.endAt?.toISOString() ?? null,
      dayOfWeek: r.dayOfWeek,
      startMin: r.startMin,
      endMin: r.endMin,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
