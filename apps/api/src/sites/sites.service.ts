import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

const siteInclude = {
  devices: {
    select: {
      id: true,
      name: true,
      platform: true,
      status: true,
      lastSeenAt: true,
    },
    orderBy: { name: 'asc' as const },
  },
  coverAsset: {
    select: {
      id: true,
      name: true,
      kind: true,
      mimeType: true,
      thumbnailKey: true,
    },
  },
};

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.site.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: siteInclude,
    });
  }

  async getById(tenantId: string, id: string) {
    const site = await this.prisma.site.findFirst({
      where: { id, tenantId },
      include: siteInclude,
    });
    if (!site) throw new NotFoundException('Site não encontrado');
    return site;
  }

  private async assertImageCoverAsset(tenantId: string, assetId: string) {
    const a = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
    });
    if (!a) throw new BadRequestException('Asset de capa não encontrado');
    if (a.kind !== 'image') {
      throw new BadRequestException('A capa do espaço deve ser um asset do tipo imagem');
    }
  }

  async create(tenantId: string, dto: CreateSiteDto) {
    if (dto.coverAssetId) {
      await this.assertImageCoverAsset(tenantId, dto.coverAssetId);
    }
    return this.prisma.site.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        timezone: dto.timezone ?? 'America/Sao_Paulo',
        coverAssetId: dto.coverAssetId,
      },
      include: siteInclude,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateSiteDto) {
    await this.getById(tenantId, id);
    if (dto.coverAssetId !== undefined && dto.coverAssetId !== null) {
      await this.assertImageCoverAsset(tenantId, dto.coverAssetId);
    }
    return this.prisma.site.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.coverAssetId !== undefined ? { coverAssetId: dto.coverAssetId } : {}),
      },
      include: siteInclude,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.getById(tenantId, id);
    const count = await this.prisma.device.count({ where: { siteId: id } });
    if (count > 0) {
      throw new BadRequestException(
        'Não é possível excluir o espaço enquanto existirem dispositivos associados'
      );
    }
    await this.prisma.site.delete({ where: { id } });
    return { ok: true };
  }
}
