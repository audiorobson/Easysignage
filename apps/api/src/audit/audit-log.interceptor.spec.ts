import { of, throwError } from 'rxjs';
import {
  AuditLogInterceptor,
  deriveEntityTypeFromController,
  extractClientIp,
  extractEntityId,
} from './audit-log.interceptor';
import { AuditLogService } from './audit-log.service';

describe('deriveEntityTypeFromController', () => {
  it('converte PascalCase de controller para kebab-case sem sufixo', () => {
    expect(deriveEntityTypeFromController('AssetsController')).toBe('assets');
    expect(deriveEntityTypeFromController('DeviceApiController')).toBe('device-api');
    expect(deriveEntityTypeFromController('SettingsController')).toBe('settings');
    expect(deriveEntityTypeFromController('VideoWallsController')).toBe('video-walls');
  });
});

describe('extractEntityId', () => {
  it('retorna params.id quando presente', () => {
    expect(extractEntityId({ id: 'abc-123' })).toBe('abc-123');
  });
  it('retorna null quando ausente ou não é string', () => {
    expect(extractEntityId(undefined)).toBeNull();
    expect(extractEntityId({})).toBeNull();
    expect(extractEntityId({ id: 42 })).toBeNull();
  });
});

describe('extractClientIp', () => {
  it('prioriza x-forwarded-for', () => {
    expect(
      extractClientIp({
        headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
        ip: '10.0.0.1',
      })
    ).toBe('203.0.113.5');
  });
  it('usa request.ip quando não há x-forwarded-for', () => {
    expect(extractClientIp({ ip: '10.0.0.9' })).toBe('10.0.0.9');
  });
  it('usa socket.remoteAddress como último recurso', () => {
    expect(extractClientIp({ socket: { remoteAddress: '10.0.0.7' } })).toBe('10.0.0.7');
  });
  it('retorna null quando nada disponível', () => {
    expect(extractClientIp({})).toBeNull();
  });
});

function buildContext(overrides: {
  method?: string;
  user?: { userId: string; tenantId: string; email: string; permissions: string[] };
  params?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, unknown>;
  statusCode?: number;
  controllerName?: string;
}) {
  const request = {
    method: overrides.method ?? 'POST',
    user: overrides.user,
    params: overrides.params ?? {},
    body: overrides.body,
    headers: overrides.headers ?? {},
    ip: '127.0.0.1',
  };
  const response = { statusCode: overrides.statusCode ?? 201 };
  class FakeController {}
  Object.defineProperty(FakeController, 'name', {
    value: overrides.controllerName ?? 'AssetsController',
  });
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getClass: () => FakeController,
    getHandler: () => function handler() {},
  } as any;
}

describe('AuditLogInterceptor', () => {
  function buildService() {
    return { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogService;
  }

  it('ignora métodos GET (não regista)', async () => {
    const service = buildService();
    const interceptor = new AuditLogInterceptor(service);
    const ctx = buildContext({ method: 'GET', user: { userId: 'u1', tenantId: 't1', email: 'a@b.com', permissions: [] } });
    const handler = { handle: () => of({ ok: true }) };

    await new Promise((resolve) => interceptor.intercept(ctx, handler).subscribe({ complete: resolve as () => void }));

    expect(service.record).not.toHaveBeenCalled();
  });

  it('ignora requisições sem utilizador CMS autenticado (ex. device-api)', async () => {
    const service = buildService();
    const interceptor = new AuditLogInterceptor(service);
    const ctx = buildContext({ method: 'POST', user: undefined });
    const handler = { handle: () => of({ ok: true }) };

    await new Promise((resolve) => interceptor.intercept(ctx, handler).subscribe({ complete: resolve as () => void }));

    expect(service.record).not.toHaveBeenCalled();
  });

  it('regista mutação bem sucedida com actor, entidade e resposta', async () => {
    const service = buildService();
    const interceptor = new AuditLogInterceptor(service);
    const ctx = buildContext({
      method: 'PATCH',
      user: { userId: 'u1', tenantId: 't1', email: 'admin@empresa.com', permissions: ['*'] },
      params: { id: 'asset-1' },
      body: { name: 'Novo nome' },
      controllerName: 'AssetsController',
      statusCode: 200,
    });
    const handler = { handle: () => of({ id: 'asset-1', name: 'Novo nome' }) };

    await new Promise((resolve) => interceptor.intercept(ctx, handler).subscribe({ complete: resolve as () => void }));
    // deixa o microtask do .record() (best-effort, não aguardado no pipe) correr
    await new Promise((r) => setImmediate(r));

    expect(service.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        actorUserId: 'u1',
        actorEmail: 'admin@empresa.com',
        method: 'PATCH',
        entityType: 'assets',
        entityId: 'asset-1',
        statusCode: 200,
        success: true,
        requestBody: { name: 'Novo nome' },
        responseBody: { id: 'asset-1', name: 'Novo nome' },
      })
    );
  });

  it('regista falha (exceção do handler) com success=false e propaga o erro', async () => {
    const service = buildService();
    const interceptor = new AuditLogInterceptor(service);
    const ctx = buildContext({
      method: 'DELETE',
      user: { userId: 'u1', tenantId: 't1', email: 'admin@empresa.com', permissions: ['*'] },
      params: { id: 'asset-1' },
      controllerName: 'AssetsController',
    });
    const error = Object.assign(new Error('Não encontrado'), { status: 404 });
    const handler = { handle: () => throwError(() => error) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({
        error: () => resolve(),
      });
    });
    await new Promise((r) => setImmediate(r));

    expect(service.record).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'DELETE',
        entityType: 'assets',
        entityId: 'asset-1',
        statusCode: 404,
        success: false,
      })
    );
  });
});
