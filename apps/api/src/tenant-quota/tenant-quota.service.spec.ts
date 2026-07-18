import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantQuotaService } from './tenant-quota.service';
import { PrismaService } from '../prisma/prisma.service';

function buildPrismaMock() {
  return {
    tenant: { findUnique: jest.fn() },
    device: { count: jest.fn() },
    user: { count: jest.fn() },
  };
}

describe('TenantQuotaService.getUsage', () => {
  it('devolve o plano e o uso atual de devices/utilizadores', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({ planTier: 'pro', maxDevices: 50, maxUsers: 20 });
    prisma.device.count.mockResolvedValue(12);
    prisma.user.count.mockResolvedValue(4);
    const service = new TenantQuotaService(prisma as unknown as PrismaService);

    const usage = await service.getUsage('tenant-1');

    expect(usage).toEqual({
      planTier: 'pro',
      devices: { used: 12, max: 50 },
      users: { used: 4, max: 20 },
    });
  });

  it('lança NotFoundException quando o tenant não existe', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue(null);
    const service = new TenantQuotaService(prisma as unknown as PrismaService);

    await expect(service.getUsage('tenant-x')).rejects.toThrow(NotFoundException);
  });
});

describe('TenantQuotaService.assertCanCreateDevice', () => {
  it('permite criar quando o uso está abaixo do limite', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({ maxDevices: 25 });
    prisma.device.count.mockResolvedValue(24);
    const service = new TenantQuotaService(prisma as unknown as PrismaService);

    await expect(service.assertCanCreateDevice('tenant-1')).resolves.toBeUndefined();
  });

  it('bloqueia quando o uso já atingiu o limite', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({ maxDevices: 25 });
    prisma.device.count.mockResolvedValue(25);
    const service = new TenantQuotaService(prisma as unknown as PrismaService);

    await expect(service.assertCanCreateDevice('tenant-1')).rejects.toThrow(ForbiddenException);
  });

  it('bloqueia quando o uso já excede o limite', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({ maxDevices: 5 });
    prisma.device.count.mockResolvedValue(9);
    const service = new TenantQuotaService(prisma as unknown as PrismaService);

    await expect(service.assertCanCreateDevice('tenant-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TENANT_DEVICE_QUOTA_EXCEEDED', used: 9, max: 5 }),
    });
  });

  it('lança NotFoundException quando o tenant não existe', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue(null);
    const service = new TenantQuotaService(prisma as unknown as PrismaService);

    await expect(service.assertCanCreateDevice('tenant-x')).rejects.toThrow(NotFoundException);
  });
});

describe('TenantQuotaService.assertCanCreateUser', () => {
  it('permite criar quando o uso está abaixo do limite', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({ maxUsers: 10 });
    prisma.user.count.mockResolvedValue(3);
    const service = new TenantQuotaService(prisma as unknown as PrismaService);

    await expect(service.assertCanCreateUser('tenant-1')).resolves.toBeUndefined();
  });

  it('bloqueia quando o uso já atingiu o limite', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({ maxUsers: 10 });
    prisma.user.count.mockResolvedValue(10);
    const service = new TenantQuotaService(prisma as unknown as PrismaService);

    await expect(service.assertCanCreateUser('tenant-1')).rejects.toThrow(ForbiddenException);
  });
});
