import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

function buildPrismaMock() {
  return {
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  } as unknown as PrismaService;
}

describe('AuditLogService', () => {
  it('record() grava a linha com o payload sanitizado', async () => {
    const prisma = buildPrismaMock();
    const service = new AuditLogService(prisma);

    await service.record({
      tenantId: 't1',
      actorUserId: 'u1',
      actorEmail: 'admin@empresa.com',
      method: 'PATCH',
      entityType: 'settings',
      entityId: null,
      statusCode: 200,
      success: true,
      requestBody: { alertWebhookSecret: 'segredo', alertNotifyEmails: 'a@b.com' },
      responseBody: { ok: true },
      ip: '127.0.0.1',
      userAgent: 'jest',
    });

    expect((prisma as any).auditLog.create).toHaveBeenCalledTimes(1);
    const arg = (prisma as any).auditLog.create.mock.calls[0][0];
    expect(arg.data.tenantId).toBe('t1');
    expect(arg.data.requestJson.alertWebhookSecret).toBe('[REDACTED]');
    expect(arg.data.requestJson.alertNotifyEmails).toBe('a@b.com');
  });

  it('record() nunca lança — falha da BD só gera aviso (best-effort)', async () => {
    const prisma = buildPrismaMock();
    (prisma as any).auditLog.create.mockRejectedValue(new Error('DB down'));
    const service = new AuditLogService(prisma);

    await expect(
      service.record({
        tenantId: 't1',
        actorUserId: null,
        actorEmail: null,
        method: 'POST',
        entityType: 'assets',
        entityId: null,
        statusCode: 201,
        success: true,
        ip: null,
        userAgent: null,
      })
    ).resolves.toBeUndefined();
  });

  it('list() aplica filtros de actor/entityType/método/período e devolve paginação', async () => {
    const prisma = buildPrismaMock();
    (prisma as any).auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        actorUserId: 'u1',
        actorEmail: 'admin@empresa.com',
        method: 'POST',
        entityType: 'assets',
        entityId: 'a1',
        statusCode: 201,
        success: true,
        requestJson: null,
        responseJson: null,
        ip: null,
        userAgent: null,
        createdAt: new Date('2026-07-18T10:00:00.000Z'),
      },
    ]);
    (prisma as any).auditLog.count.mockResolvedValue(1);
    const service = new AuditLogService(prisma);

    const page = await service.list('t1', {
      actorEmail: 'admin',
      entityType: 'assets',
      method: 'POST',
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-31T00:00:00.000Z',
      page: 1,
      pageSize: 10,
    });

    expect(page.total).toBe(1);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0].createdAt).toBe('2026-07-18T10:00:00.000Z');

    const where = (prisma as any).auditLog.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe('t1');
    expect(where.entityType).toBe('assets');
    expect(where.method).toBe('POST');
    expect(where.actorEmail).toEqual({ contains: 'admin', mode: 'insensitive' });
  });

  it('list() usa página/tamanho por omissão e limita o pageSize máximo', async () => {
    const prisma = buildPrismaMock();
    const service = new AuditLogService(prisma);

    await service.list('t1', { pageSize: 9999 });

    const call = (prisma as any).auditLog.findMany.mock.calls[0][0];
    expect(call.take).toBe(200);
    expect(call.skip).toBe(0);
  });
});
