import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LayoutTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const rows = await this.prisma.layoutTemplate.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId }],
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        zonesJson: true,
        sortOrder: true,
        tenantId: true,
      },
    });
    return rows;
  }
}
