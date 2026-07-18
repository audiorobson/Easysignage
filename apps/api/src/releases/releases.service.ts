import { Injectable } from '@nestjs/common';
import {
  pickLatestRelease,
  type SoftwareReleaseChannel,
  type SoftwareReleaseSummary,
} from '@easysignage/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReleaseDto } from './dto/create-release.dto';

const DEFAULT_PRODUCT = 'electron-player';

@Injectable()
export class ReleasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReleaseDto) {
    return this.prisma.softwareRelease.create({
      data: {
        product: dto.product?.trim() || DEFAULT_PRODUCT,
        version: dto.version.trim(),
        channel: dto.channel ?? 'stable',
        checksum: dto.checksum?.trim() || null,
        downloadUrl: dto.downloadUrl?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async list(product?: string) {
    return this.prisma.softwareRelease.findMany({
      where: product ? { product } : undefined,
      orderBy: { publishedAt: 'desc' },
      take: 200,
    });
  }

  /** Escolhe a maior versão compatível com o canal — usada pelo player para decidir auto-update. */
  async latestForChannel(
    product: string,
    channel: SoftwareReleaseChannel
  ): Promise<SoftwareReleaseSummary | null> {
    const rows = await this.prisma.softwareRelease.findMany({
      where: { product },
      take: 500,
    });
    const summaries: SoftwareReleaseSummary[] = rows.map((r) => ({
      product: r.product,
      version: r.version,
      channel: r.channel === 'beta' ? 'beta' : 'stable',
      downloadUrl: r.downloadUrl,
      checksum: r.checksum,
      notes: r.notes,
      publishedAt: r.publishedAt.toISOString(),
    }));
    return pickLatestRelease(summaries, channel);
  }
}
