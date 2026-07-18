import {
  AlertNotificationsService,
  buildEmailBody,
  buildEmailSubject,
  parseEmailList,
  signWebhookBody,
  type AlertNotificationPayload,
} from './alert-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { EmailSender } from './email-sender';

function buildPrismaMock() {
  return {
    tenant: { findUnique: jest.fn() },
  };
}

function buildPayload(overrides: Partial<AlertNotificationPayload> = {}): AlertNotificationPayload {
  return {
    tenantId: 'tenant-1',
    deviceId: 'device-1',
    alertId: 'alert-1',
    alertType: 'device_offline',
    severity: 'warning',
    status: 'open',
    title: 'Totem Entrada — offline',
    message: 'Sem presença recente.',
    occurredAt: '2026-07-18T10:00:00.000Z',
    ...overrides,
  };
}

describe('parseEmailList', () => {
  it('separa por vírgula, remove espaços e entradas vazias', () => {
    expect(parseEmailList(' a@x.com, b@y.com ,, ')).toEqual(['a@x.com', 'b@y.com']);
  });

  it('devolve array vazio para null/undefined/string vazia', () => {
    expect(parseEmailList(null)).toEqual([]);
    expect(parseEmailList(undefined)).toEqual([]);
    expect(parseEmailList('')).toEqual([]);
  });
});

describe('signWebhookBody', () => {
  it('gera uma assinatura HMAC-SHA256 determinística em hex', () => {
    const sig = signWebhookBody('segredo', '{"a":1}');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(signWebhookBody('segredo', '{"a":1}')).toBe(sig);
    expect(signWebhookBody('outro-segredo', '{"a":1}')).not.toBe(sig);
  });
});

describe('buildEmailSubject / buildEmailBody', () => {
  it('usa prefixo diferente para alerta aberto vs. resolvido', () => {
    expect(buildEmailSubject(buildPayload({ status: 'open' }))).toContain('Alerta:');
    expect(buildEmailSubject(buildPayload({ status: 'resolved' }))).toContain('Resolvido:');
  });

  it('inclui tenant, severidade, título e mensagem no corpo', () => {
    const body = buildEmailBody('Loja Centro', buildPayload());
    expect(body).toContain('Tenant: Loja Centro');
    expect(body).toContain('Severidade: warning');
    expect(body).toContain('Título: Totem Entrada — offline');
    expect(body).toContain('Mensagem: Sem presença recente.');
  });

  it('omite a linha de mensagem quando message é null', () => {
    const body = buildEmailBody('Loja Centro', buildPayload({ message: null }));
    expect(body).not.toContain('Mensagem:');
  });
});

describe('AlertNotificationsService.notify', () => {
  function buildEmailSenderMock(): jest.Mocked<EmailSender> {
    return { send: jest.fn().mockResolvedValue(undefined) };
  }

  it('não faz nada quando o tenant não existe', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue(null);
    const emailSender = buildEmailSenderMock();
    const service = new AlertNotificationsService(prisma as unknown as PrismaService, emailSender);

    await service.notify(buildPayload());

    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it('não envia webhook nem e-mail quando o tenant não configurou nenhum dos dois', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({
      name: 'Loja Centro',
      alertWebhookUrl: null,
      alertWebhookSecret: null,
      alertNotifyEmails: null,
    });
    const emailSender = buildEmailSenderMock();
    const fetchSpy = jest.spyOn(global, 'fetch');
    const service = new AlertNotificationsService(prisma as unknown as PrismaService, emailSender);

    await service.notify(buildPayload());

    expect(emailSender.send).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('envia e-mail para a lista configurada quando há alertNotifyEmails', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({
      name: 'Loja Centro',
      alertWebhookUrl: null,
      alertWebhookSecret: null,
      alertNotifyEmails: 'ops@loja.com, gestor@loja.com',
    });
    const emailSender = buildEmailSenderMock();
    const service = new AlertNotificationsService(prisma as unknown as PrismaService, emailSender);

    await service.notify(buildPayload({ status: 'resolved' }));

    expect(emailSender.send).toHaveBeenCalledTimes(1);
    const call = emailSender.send.mock.calls[0][0];
    expect(call.to).toEqual(['ops@loja.com', 'gestor@loja.com']);
    expect(call.subject).toContain('Resolvido:');
  });

  it('faz POST no webhook configurado, assinando o corpo quando há secret', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({
      name: 'Loja Centro',
      alertWebhookUrl: 'https://hooks.example.com/alerts',
      alertWebhookSecret: 'segredo-webhook',
      alertNotifyEmails: null,
    });
    const emailSender = buildEmailSenderMock();
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200 } as Response);
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(fetchMock);
    const service = new AlertNotificationsService(prisma as unknown as PrismaService, emailSender);

    const payload = buildPayload();
    await service.notify(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://hooks.example.com/alerts');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ event: 'alert.open', data: payload });
    expect(init.headers['X-EasySignage-Signature']).toBe(signWebhookBody('segredo-webhook', init.body as string));
    fetchSpy.mockRestore();
  });

  it('não lança quando o webhook falha (best-effort)', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({
      name: 'Loja Centro',
      alertWebhookUrl: 'https://hooks.example.com/alerts',
      alertWebhookSecret: null,
      alertNotifyEmails: null,
    });
    const emailSender = buildEmailSenderMock();
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('timeout'));
    const service = new AlertNotificationsService(prisma as unknown as PrismaService, emailSender);

    await expect(service.notify(buildPayload())).resolves.toBeUndefined();
    fetchSpy.mockRestore();
  });

  it('não lança quando o e-mail falha (best-effort)', async () => {
    const prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({
      name: 'Loja Centro',
      alertWebhookUrl: null,
      alertWebhookSecret: null,
      alertNotifyEmails: 'ops@loja.com',
    });
    const emailSender: jest.Mocked<EmailSender> = {
      send: jest.fn().mockRejectedValue(new Error('resend indisponível')),
    };
    const service = new AlertNotificationsService(prisma as unknown as PrismaService, emailSender);

    await expect(service.notify(buildPayload())).resolves.toBeUndefined();
  });
});
