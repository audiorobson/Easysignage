import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

function buildPrismaMock() {
  return {
    tenant: { findUnique: jest.fn(), update: jest.fn() },
  };
}

describe('SettingsService.getAlertNotifications', () => {
  it('mascara o segredo do webhook e indica presença sem devolver o valor em claro', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({
      alertWebhookUrl: 'https://hooks.example.com/x',
      alertWebhookSecret: 'super-segredo-1234',
      alertNotifyEmails: 'a@x.com',
    });
    const service = new SettingsService(prisma as unknown as PrismaService);

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
    const service = new SettingsService(prisma as unknown as PrismaService);

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
    const service = new SettingsService(prisma as unknown as PrismaService);

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
    const service = new SettingsService(prisma as unknown as PrismaService);

    await service.updateAlertNotifications('tenant-1', { alertWebhookSecret: 'novo-segredo' });

    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { alertWebhookSecret: 'novo-segredo' } })
    );
  });
});
