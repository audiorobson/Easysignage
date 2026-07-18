import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditLogService } from './audit-log.service';
import type { JwtUser } from '../common/decorators/current-user.decorator';

const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface FastifyLikeRequest {
  method?: string;
  params?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, unknown>;
  ip?: string;
  socket?: { remoteAddress?: string };
  user?: JwtUser;
}

interface FastifyLikeResponse {
  statusCode?: number;
}

/**
 * Converte "AssetsController" → "assets", "DeviceApiController" → "device-api".
 * Puro/exportado para ser testável isoladamente.
 */
export function deriveEntityTypeFromController(controllerName: string): string {
  const base = controllerName.replace(/Controller$/, '');
  return base
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

export function extractEntityId(params: Record<string, unknown> | undefined): string | null {
  if (!params) return null;
  const id = params.id;
  return typeof id === 'string' ? id : null;
}

export function extractClientIp(req: FastifyLikeRequest): string | null {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (req.ip) return req.ip;
  if (req.socket?.remoteAddress) return req.socket.remoteAddress;
  return null;
}

/**
 * Fase 6, PR 6.2 — regista toda mutação (POST/PUT/PATCH/DELETE) feita por um
 * utilizador CMS autenticado (`request.user`, populado pelo `JwtAuthGuard`).
 * Rotas de device-api (`request.device`) e públicas ficam de fora naturalmente,
 * pois nunca têm `request.user`. Registado globalmente via `APP_INTERCEPTOR`
 * em `AuditModule` — nenhum controller precisa de decorators extra.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly auditLog: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<FastifyLikeRequest>();
    const method = (request.method ?? '').toUpperCase();

    if (!AUDITED_METHODS.has(method) || !request.user?.tenantId) {
      return next.handle();
    }

    const user = request.user;
    const entityType = deriveEntityTypeFromController(context.getClass().name);
    const entityId = extractEntityId(request.params);
    const ip = extractClientIp(request);
    const userAgent =
      typeof request.headers?.['user-agent'] === 'string'
        ? (request.headers['user-agent'] as string)
        : null;
    const requestBody = request.body;

    return next.handle().pipe(
      tap((responseBody) => {
        const response = http.getResponse<FastifyLikeResponse>();
        this.recordAsync({
          tenantId: user.tenantId,
          actorUserId: user.userId,
          actorEmail: user.email,
          method,
          entityType,
          entityId,
          statusCode: response?.statusCode ?? 200,
          success: true,
          requestBody,
          responseBody,
          ip,
          userAgent,
        });
      }),
      catchError((err) => {
        const statusCode =
          (err && (err.status ?? err.statusCode)) || 500;
        this.recordAsync({
          tenantId: user.tenantId,
          actorUserId: user.userId,
          actorEmail: user.email,
          method,
          entityType,
          entityId,
          statusCode,
          success: false,
          requestBody,
          responseBody: { error: err instanceof Error ? err.message : String(err) },
          ip,
          userAgent,
        });
        return throwError(() => err);
      })
    );
  }

  private recordAsync(entry: Parameters<AuditLogService['record']>[0]): void {
    this.auditLog.record(entry).catch((e) => {
      this.logger.warn(`Falha inesperada ao registar audit log: ${e}`);
    });
  }
}
