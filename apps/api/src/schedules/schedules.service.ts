import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { UpdateScheduleRuleDto } from './dto/update-schedule-rule.dto';
import { ScheduleEngineService } from './schedule-engine.service';

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

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleEngine: ScheduleEngineService
  ) {}

  async list(tenantId: string) {
    const rows = await this.prisma.scheduleRule.findMany({
      where: { tenantId },
      orderBy: [{ priority: 'desc' }, { dayOfWeek: 'asc' }, { startMin: 'asc' }],
      include: {
        playlist: { select: { id: true, name: true } },
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
    await this.ensureRefs(tenantId, dto.playlistId, dto.scope, dto.deviceId, dto.groupId);

    const row = await this.prisma.scheduleRule.create({
      data: {
        tenantId,
        name: dto.name?.trim() || null,
        playlistId: dto.playlistId,
        scope: dto.scope,
        deviceId: dto.scope === 'device' ? dto.deviceId! : null,
        groupId: dto.scope === 'group' ? dto.groupId! : null,
        dayOfWeek: dto.dayOfWeek,
        startMin: dto.startMin,
        endMin: dto.endMin,
        priority: dto.priority ?? 0,
        enabled: dto.enabled ?? true,
      },
      include: {
        playlist: { select: { id: true, name: true } },
        device: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
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
    const playlistId = dto.playlistId ?? existing.playlistId;

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
    await this.ensureRefs(tenantId, playlistId, scope, deviceId ?? undefined, groupId ?? undefined);

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
        ...(dto.playlistId != null ? { playlistId: dto.playlistId } : {}),
        scope,
        deviceId,
        groupId,
        ...(dto.dayOfWeek != null ? { dayOfWeek: dto.dayOfWeek } : {}),
        ...(dto.startMin != null ? { startMin: dto.startMin } : {}),
        ...(dto.endMin != null ? { endMin: dto.endMin } : {}),
        ...(dto.priority != null ? { priority: dto.priority } : {}),
        ...(dto.enabled != null ? { enabled: dto.enabled } : {}),
      },
      include: {
        playlist: { select: { id: true, name: true } },
        device: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
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

  /** Reaplica agenda em todos os devices do tenant (útil após migração ou testes). */
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

  private async ensureRefs(
    tenantId: string,
    playlistId: string,
    scope: 'device' | 'group',
    deviceId?: string,
    groupId?: string
  ) {
    const pl = await this.prisma.playlist.findFirst({
      where: { id: playlistId, tenantId },
    });
    if (!pl) throw new BadRequestException('Playlist inválida');

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
  }

  private toRow(r: {
    id: string;
    tenantId: string;
    name: string | null;
    playlistId: string;
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
    playlist: { id: string; name: string };
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
    return {
      id: r.id,
      name: r.name,
      playlistId: r.playlistId,
      playlist: r.playlist,
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
