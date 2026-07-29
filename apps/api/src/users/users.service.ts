import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TenantQuotaService } from '../tenant-quota/tenant-quota.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantQuota: TenantQuotaService
  ) {}

  async listRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async list(tenantId: string) {
    const rows = await this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        totpEnabled: true,
        createdAt: true,
        userRoles: {
          select: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      status: r.status,
      totpEnabled: r.totpEnabled,
      roles: r.userRoles.map((ur) => ur.role),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async create(tenantId: string, dto: CreateUserDto) {
    await this.tenantQuota.assertCanCreateUser(tenantId);

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email },
    });
    if (existing) {
      throw new ConflictException('Já existe um utilizador com este e-mail');
    }

    const roles = await this.prisma.role.findMany({
      where: { tenantId, id: { in: dto.roleIds } },
      select: { id: true },
    });
    if (roles.length !== dto.roleIds.length) {
      throw new NotFoundException('Um ou mais papéis não pertencem a este tenant');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        email,
        passwordHash,
        status: 'active',
        userRoles: {
          create: dto.roleIds.map((roleId) => ({ roleId })),
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        totpEnabled: true,
        createdAt: true,
        userRoles: {
          select: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      totpEnabled: user.totpEnabled,
      roles: user.userRoles.map((ur) => ur.role),
      createdAt: user.createdAt.toISOString(),
    };
  }
}
