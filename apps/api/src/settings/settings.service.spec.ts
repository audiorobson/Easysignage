import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { TenantQuotaService } from '../tenant-quota/tenant-quota.service';

function buildPrismaMock() {
  return {
    tenant: { findUnique: jest.fn(), update: jest.fn() },
  };
}

function buildConfigMock() {
  return { get: jest.fn() } as unknown as ConfigService;
}

function buildQuotaMock() {
  return { getUsage: jest.fn() } as unknown as TenantQuotaService;
}

describe('SettingsService.getAlertNotifications', () => {
  it('mascara o segredo do webhook e indica presença sem devolver o valor em claro', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({
      alertWebhookUrl: 'https://hooks.example.com/x',
      alertWebhookSecret: 'super-segredo-1234',
      alertNotifyEmails: 'a@x.com',
    });
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      buildConfigMock(),
      buildQuotaMock()
    );

    const result = await service.getAlertNotifications('tenant-1');

    expect(result.alertWebhookUrl).toBe('https://hooks.example.com/x');
    expect(result.alertWebhookSecretMasked).toBe('••••1234');
    expect(result.hasWebhookSecret).toBe(true);
    expect(result.alertNotifyEmails).toBe('a@x.com');
    expect(result).not.toHaveProperty('alertWebhookSecret');
  });

  it('lança NotFoundException quando o tenant não existe', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue(null);
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      buildConfigMock(),
      buildQuotaMock()
    );

    await expect(service.getAlertNotifications('tenant-x')).rejects.toThrow('Tenant não encontrado');
  });
});

describe('SettingsService.updateAlertNotifications', () => {
  it('normaliza strings vazias para null e grava apenas os campos enviados', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.update.mockResolvedValue({
      alertWebhookUrl: null,
      alertWebhookSecret: null,
      alertNotifyEmails: 'ops@loja.com',
    });
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      buildConfigMock(),
      buildQuotaMock()
    );

    await service.updateAlertNotifications('tenant-1', {
      alertWebhookUrl: '   ',
      alertNotifyEmails: 'ops@loja.com',
    });

    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant-1' },
        data: { alertWebhookUrl: null, alertNotifyEmails: 'ops@loja.com' },
      })
    );
  });

  it('não altera campos que não foram enviados no DTO', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.update.mockResolvedValue({
      alertWebhookUrl: 'https://hooks.example.com/x',
      alertWebhookSecret: null,
      alertNotifyEmails: null,
    });
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      buildConfigMock(),
      buildQuotaMock()
    );

    await service.updateAlertNotifications('tenant-1', { alertWebhookSecret: 'novo-segredo' });

    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { alertWebhookSecret: 'novo-segredo' } })
    );
  });
});

describe('SettingsService.getSsoConfig', () => {
  it('não devolve o client secret em claro, apenas se está definido', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({
      ssoEnabled: true,
      ssoIssuerUrl: 'https://idp.example.com',
      ssoClientId: 'client-abc',
      ssoClientSecret: 'super-secreto',
    });
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      buildConfigMock(),
      buildQuotaMock()
    );

    const result = await service.getSsoConfig('tenant-1');

    expect(result).toMatchObject({
      ssoEnabled: true,
      ssoIssuerUrl: 'https://idp.example.com',
      ssoClientId: 'client-abc',
      hasClientSecret: true,
    });
    expect(result.redirectUri).toMatch(/\/auth\/sso\/callback$/);
  });

  it('lança NotFoundException quando o tenant não existe', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue(null);
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      buildConfigMock(),
      buildQuotaMock()
    );

    await expect(service.getSsoConfig('tenant-x')).rejects.toThrow('Tenant não encontrado');
  });
});

describe('SettingsService.updateSsoConfig', () => {
  it('rejeita ativar o SSO sem issuer/clientId/clientSecret configurados', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({
      ssoEnabled: false,
      ssoIssuerUrl: null,
      ssoClientId: null,
      ssoClientSecret: null,
    });
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      buildConfigMock(),
      buildQuotaMock()
    );

    await expect(service.updateSsoConfig('tenant-1', { ssoEnabled: true })).rejects.toThrow(
      'Para ativar o SSO'
    );
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('ativa o SSO quando issuer/clientId/clientSecret já estão configurados', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({
      ssoEnabled: false,
      ssoIssuerUrl: 'https://idp.example.com',
      ssoClientId: 'client-abc',
      ssoClientSecret: 'segredo',
    });
    prisma.tenant.update.mockResolvedValue({
      ssoEnabled: true,
      ssoIssuerUrl: 'https://idp.example.com',
      ssoClientId: 'client-abc',
      ssoClientSecret: 'segredo',
    });
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      buildConfigMock(),
      buildQuotaMock()
    );

    const result = await service.updateSsoConfig('tenant-1', { ssoEnabled: true });

    expect(result.ssoEnabled).toBe(true);
    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ssoEnabled: true }),
      })
    );
  });

  it('mantém o client secret atual quando o DTO não envia um novo valor', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({
      ssoEnabled: true,
      ssoIssuerUrl: 'https://idp.example.com',
      ssoClientId: 'client-abc',
      ssoClientSecret: 'segredo-atual',
    });
    prisma.tenant.update.mockResolvedValue({
      ssoEnabled: true,
      ssoIssuerUrl: 'https://idp.example.com',
      ssoClientId: 'client-novo',
      ssoClientSecret: 'segredo-atual',
    });
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      buildConfigMock(),
      buildQuotaMock()
    );

    await service.updateSsoConfig('tenant-1', { ssoClientId: 'client-novo' });

    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ssoClientId: 'client-novo',
          ssoClientSecret: 'segredo-atual',
        }),
      })
    );
  });

  it('desativa o SSO sem exigir configuração completa', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({
      ssoEnabled: true,
      ssoIssuerUrl: 'https://idp.example.com',
      ssoClientId: 'client-abc',
      ssoClientSecret: 'segredo',
    });
    prisma.tenant.update.mockResolvedValue({
      ssoEnabled: false,
      ssoIssuerUrl: 'https://idp.example.com',
      ssoClientId: 'client-abc',
      ssoClientSecret: 'segredo',
    });
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      buildConfigMock(),
      buildQuotaMock()
    );

    const result = await service.updateSsoConfig('tenant-1', { ssoEnabled: false });

    expect(result.ssoEnabled).toBe(false);
  });
});

describe('SettingsService.getBranding', () => {
  it('devolve os campos de branding do tenant', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({
      brandName: 'Acme Signage',
      brandLogoUrl: 'https://cdn.acme.com/logo.png',
      brandPrimaryColor: '#ff0044',
    });
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      buildConfigMock(),
      buildQuotaMock()
    );

    const result = await service.getBranding('tenant-1');

    expect(result).toEqual({
      brandName: 'Acme Signage',
      brandLogoUrl: 'https://cdn.acme.com/logo.png',
      brandPrimaryColor: '#ff0044',
    });
  });

  it('lança NotFoundException quando o tenant não existe', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue(null);
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      buildConfigMock(),
      buildQuotaMock()
    );

    await expect(service.getBranding('tenant-x')).rejects.toThrow('Tenant não encontrado');
  });
});

describe('SettingsService.updateBranding', () => {
  it('actualiza apenas os campos enviados no DTO', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.update.mockResolvedValue({
      brandName: 'Acme Signage',
      brandLogoUrl: null,
      brandPrimaryColor: '#2563eb',
    });
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      buildConfigMock(),
      buildQuotaMock()
    );

    const result = await service.updateBranding('tenant-1', {
      brandName: 'Acme Signage',
      brandPrimaryColor: '#2563eb',
    });

    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant-1' },
        data: { brandName: 'Acme Signage', brandPrimaryColor: '#2563eb' },
      })
    );
    expect(result.brandName).toBe('Acme Signage');
  });

  it('limpa um campo quando recebe string vazia', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.update.mockResolvedValue({
      brandName: null,
      brandLogoUrl: null,
      brandPrimaryColor: null,
    });
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      buildConfigMock(),
      buildQuotaMock()
    );

    await service.updateBranding('tenant-1', { brandName: '' });

    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { brandName: null } })
    );
  });
});

describe('SettingsService.getQuotaUsage', () => {
  it('delega no TenantQuotaService', async () => {
    const prisma = buildPrismaMock();
    const quota = buildQuotaMock();
    (quota.getUsage as jest.Mock).mockResolvedValue({
      planTier: 'starter',
      devices: { used: 3, max: 25 },
      users: { used: 1, max: 10 },
    });
    const service = new SettingsService(prisma as unknown as PrismaService, buildConfigMock(), quota);

    const usage = await service.getQuotaUsage('tenant-1');

    expect(quota.getUsage).toHaveBeenCalledWith('tenant-1');
    expect(usage).toEqual({
      planTier: 'starter',
      devices: { used: 3, max: 25 },
      users: { used: 1, max: 10 },
    });
  });
});
