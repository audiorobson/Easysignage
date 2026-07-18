import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { PrismaService } from '../prisma/prisma.service';
import { VideoWallsService } from '../video-walls/video-walls.service';
import { LicenseService } from '../license/license.service';
import { TenantQuotaService } from '../tenant-quota/tenant-quota.service';

function buildService(overrides: { quotaThrows?: Error; siteExists?: boolean } = {}) {
  const prisma = {
    site: {
      findFirst: jest
        .fn()
        .mockResolvedValue(overrides.siteExists === false ? null : { id: 'site-1' }),
    },
    device: {
      create: jest.fn().mockResolvedValue({
        id: 'device-1',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        name: 'TV Recepção',
        serialNumber: null,
        platform: 'unknown',
        runtimeVersion: null,
        status: 'provisioned',
        lastSeenAt: null,
        pairingExpiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        site: { id: 'site-1', name: 'Loja 1' },
      }),
    },
  };
  const quota = {
    assertCanCreateDevice: overrides.quotaThrows
      ? jest.fn().mockRejectedValue(overrides.quotaThrows)
      : jest.fn().mockResolvedValue(undefined),
  };
  const service = new DevicesService(
    prisma as unknown as PrismaService,
    {} as VideoWallsService,
    {} as LicenseService,
    quota as unknown as TenantQuotaService
  );
  return { service, prisma, quota };
}

describe('DevicesService.create — enforcement de quota por tenant (PR 6.5)', () => {
  it('cria o dispositivo quando a quota do tenant permite', async () => {
    const { service, prisma, quota } = buildService();

    await service.create('tenant-1', { siteId: 'site-1', name: 'TV Recepção' } as any);

    expect(quota.assertCanCreateDevice).toHaveBeenCalledWith('tenant-1');
    expect(prisma.device.create).toHaveBeenCalled();
  });

  it('bloqueia a criação sem chegar a gravar o dispositivo quando a quota foi excedida', async () => {
    const { service, prisma } = buildService({
      quotaThrows: new ForbiddenException({ code: 'TENANT_DEVICE_QUOTA_EXCEEDED' }),
    });

    await expect(
      service.create('tenant-1', { siteId: 'site-1', name: 'TV Recepção' } as any)
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.device.create).not.toHaveBeenCalled();
  });

  it('não verifica quota quando o site não existe (falha antes, com 404)', async () => {
    const { service, quota } = buildService({ siteExists: false });

    await expect(
      service.create('tenant-1', { siteId: 'site-x', name: 'TV Recepção' } as any)
    ).rejects.toThrow(NotFoundException);
    expect(quota.assertCanCreateDevice).not.toHaveBeenCalled();
  });
});
