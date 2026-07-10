import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import {
  isReservedLayoutTemplateSlug,
  validateLayoutTemplateZones,
  type LayoutTemplateZone,
} from '@easysignage/shared-types';
import { CreateLayoutTemplateDto } from './dto/create-layout-template.dto';
import { UpdateLayoutTemplateDto } from './dto/update-layout-template.dto';

function toRow(row: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  zonesJson: unknown;
  sortOrder: number;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    zonesJson: row.zonesJson as LayoutTemplateZone[],
    sortOrder: row.sortOrder,
    tenantId: row.tenantId,
    isSystem: row.tenantId == null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class LayoutTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const rows = await this.prisma.layoutTemplate.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId }],
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toRow);
  }

  async getOne(tenantId: string, id: string) {
    const row = await this.prisma.layoutTemplate.findFirst({
      where: {
        id,
        OR: [{ tenantId: null }, { tenantId }],
      },
    });
    if (!row) throw new NotFoundException('Template não encontrado');
    return toRow(row);
  }

  async create(tenantId: string, dto: CreateLayoutTemplateDto) {
    if (isReservedLayoutTemplateSlug(dto.slug)) {
      throw new BadRequestException(
        `Slug reservado para template de sistema: ${dto.slug}`
      );
    }
    const parsed = validateLayoutTemplateZones(dto.zonesJson);
    if (!parsed.ok) throw new BadRequestException(parsed.message);

    const existing = await this.prisma.layoutTemplate.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new BadRequestException(`Slug já em uso: ${dto.slug}`);
    }

    const row = await this.prisma.layoutTemplate.create({
      data: {
        tenantId,
        slug: dto.slug,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        zonesJson: parsed.zones as Prisma.InputJsonValue,
        sortOrder: dto.sortOrder ?? 100,
      },
    });
    return toRow(row);
  }

  async update(tenantId: string, id: string, dto: UpdateLayoutTemplateDto) {
    const row = await this.ensureTenantTemplate(tenantId, id);

    let zonesJson: LayoutTemplateZone[] | undefined;
    if (dto.zonesJson != null) {
      const parsed = validateLayoutTemplateZones(dto.zonesJson);
      if (!parsed.ok) throw new BadRequestException(parsed.message);
      zonesJson = parsed.zones;
    }

    const updated = await this.prisma.layoutTemplate.update({
      where: { id: row.id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(zonesJson ? { zonesJson: zonesJson as Prisma.InputJsonValue } : {}),
        ...(dto.sortOrder != null ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return toRow(updated);
  }

  async remove(tenantId: string, id: string) {
    const row = await this.ensureTenantTemplate(tenantId, id);
    const inUse = await this.prisma.deviceLayout.count({
      where: { templateId: row.id },
    });
    if (inUse > 0) {
      throw new BadRequestException(
        `Template em uso por ${inUse} layout(s) de device — altere os devices antes de eliminar`
      );
    }
    await this.prisma.layoutTemplate.delete({ where: { id: row.id } });
    return { ok: true };
  }

  private async ensureTenantTemplate(tenantId: string, id: string) {
    const row = await this.prisma.layoutTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!row) {
      const sys = await this.prisma.layoutTemplate.findFirst({
        where: { id, tenantId: null },
      });
      if (sys) {
        throw new ForbiddenException('Templates de sistema não podem ser alterados');
      }
      throw new NotFoundException('Template não encontrado');
    }
    return row;
  }
}
