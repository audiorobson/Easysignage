import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TenantQuotaUsage {
  planTier: string;
  devices: { used: number; max: number };
  users: { used: number; max: number };
}

@Injectable()
export class TenantQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsage(tenantId: string): Promise<TenantQuotaUsage> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planTier: true, maxDevices: true, maxUsers: true },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const [deviceCount, userCount] = await Promise.all([
      this.prisma.device.count({ where: { tenantId } }),
      this.prisma.user.count({ where: { tenantId } }),
    ]);

    return {
      planTier: tenant.planTier,
      devices: { used: deviceCount, max: tenant.maxDevices },
      users: { used: userCount, max: tenant.maxUsers },
    };
  }

  /** Chamar antes de criar um novo `Device` para o tenant — lança 403 se o plano já está no limite. */
  async assertCanCreateDevice(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { maxDevices: true },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const used = await this.prisma.device.count({ where: { tenantId } });
    if (used >= tenant.maxDevices) {
      throw new ForbiddenException({
        code: 'TENANT_DEVICE_QUOTA_EXCEEDED',
        message: `Limite de dispositivos do plano atingido (${used}/${tenant.maxDevices}). Contacte o suporte para aumentar a quota.`,
        used,
        max: tenant.maxDevices,
      });
    }
  }

  /**
   * Chamar antes de criar um novo `User` para o tenant — lança 403 se o plano já está no limite.
   * Ainda não há nenhum endpoint de criação de utilizadores na aplicação (gerido hoje via seed);
   * este método existe para ser usado assim que esse módulo for implementado.
   */
  async assertCanCreateUser(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { maxUsers: true },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const used = await this.prisma.user.count({ where: { tenantId } });
    if (used >= tenant.maxUsers) {
      throw new ForbiddenException({
        code: 'TENANT_USER_QUOTA_EXCEEDED',
        message: `Limite de utilizadores do plano atingido (${used}/${tenant.maxUsers}). Contacte o suporte para aumentar a quota.`,
        used,
        max: tenant.maxUsers,
      });
    }
  }
}
