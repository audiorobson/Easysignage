import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DevicesService } from '../devices/devices.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AssignTestContentDto } from '../devices/dto/assign-test-content.dto';
import { PublishDeviceDto } from '../devices/dto/publish-device.dto';

function maskDeviceShort(d: {
  id: string;
  name: string;
  site?: { name: string } | null;
  platform: string;
  status: string;
  lastSeenAt: Date | null;
}) {
  return {
    id: d.id,
    name: d.name,
    siteName: d.site?.name,
    platform: d.platform,
    status: d.status,
    lastSeenAt: d.lastSeenAt,
  };
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devices: DevicesService
  ) {}

  async list(tenantId: string) {
    const rows = await this.prisma.deviceGroup.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { members: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      deviceCount: r._count.members,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async getById(tenantId: string, id: string) {
    const g = await this.prisma.deviceGroup.findFirst({
      where: { id, tenantId },
      include: {
        members: {
          include: {
            device: { include: { site: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!g) throw new NotFoundException('Grupo não encontrado');
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      devices: g.members.map((m) => maskDeviceShort(m.device)),
    };
  }

  create(tenantId: string, dto: CreateGroupDto) {
    return this.prisma.deviceGroup.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateGroupDto) {
    await this.ensureGroup(tenantId, id);
    return this.prisma.deviceGroup.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() ? dto.description.trim() : null }
          : {}),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.ensureGroup(tenantId, id);
    await this.prisma.deviceGroup.delete({ where: { id } });
    return { ok: true };
  }

  async addMembers(tenantId: string, groupId: string, deviceIds: string[]) {
    await this.ensureGroup(tenantId, groupId);
    const unique = [...new Set(deviceIds)];
    const devices = await this.prisma.device.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true },
    });
    if (devices.length !== unique.length) {
      throw new BadRequestException(
        'Um ou mais dispositivos não existem ou não pertencem ao tenant'
      );
    }
    await this.prisma.deviceGroupMember.createMany({
      data: unique.map((deviceId) => ({ groupId, deviceId })),
      skipDuplicates: true,
    });
    return this.getById(tenantId, groupId);
  }

  async removeMember(tenantId: string, groupId: string, deviceId: string) {
    await this.ensureGroup(tenantId, groupId);
    await this.prisma.deviceGroupMember.deleteMany({
      where: { groupId, deviceId },
    });
    return { ok: true };
  }

  private async memberDeviceIds(tenantId: string, groupId: string): Promise<string[]> {
    await this.ensureGroup(tenantId, groupId);
    const rows = await this.prisma.deviceGroupMember.findMany({
      where: { groupId },
      select: { deviceId: true },
    });
    return rows.map((r) => r.deviceId);
  }

  async assignTestContentToGroup(
    tenantId: string,
    groupId: string,
    dto: AssignTestContentDto
  ) {
    const ids = await this.memberDeviceIds(tenantId, groupId);
    if (ids.length === 0) {
      throw new BadRequestException('O grupo não tem dispositivos');
    }
    const errors: { deviceId: string; message: string }[] = [];
    for (const deviceId of ids) {
      try {
        await this.devices.assignTestContent(tenantId, deviceId, dto);
      } catch (e) {
        errors.push({
          deviceId,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return {
      ok: errors.length === 0,
      targetCount: ids.length,
      applied: ids.length - errors.length,
      errors,
    };
  }

  async publishToGroup(
    tenantId: string,
    groupId: string,
    dto: PublishDeviceDto
  ) {
    const ids = await this.memberDeviceIds(tenantId, groupId);
    if (ids.length === 0) {
      throw new BadRequestException('O grupo não tem dispositivos');
    }
    const errors: { deviceId: string; message: string }[] = [];
    const publications: { deviceId: string; publicationId: string; version: number }[] =
      [];
    for (const deviceId of ids) {
      try {
        const r = await this.devices.publishContent(tenantId, deviceId, dto);
        publications.push({
          deviceId,
          publicationId: r.publicationId,
          version: r.version,
        });
      } catch (e) {
        errors.push({
          deviceId,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return {
      ok: errors.length === 0,
      targetCount: ids.length,
      applied: publications.length,
      publications,
      errors,
    };
  }

  private async ensureGroup(tenantId: string, id: string) {
    const g = await this.prisma.deviceGroup.findFirst({ where: { id, tenantId } });
    if (!g) throw new NotFoundException('Grupo não encontrado');
    return g;
  }
}
