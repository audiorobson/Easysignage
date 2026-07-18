import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeForAudit } from './sanitize';

export interface AuditLogEntry {
  tenantId: string;
  actorUserId: string | null;
  actorEmail: string | null;
  method: string;
  entityType: string;
  entityId: string | null;
  statusCode: number;
  success: boolean;
  requestBody?: unknown;
  responseBody?: unknown;
  ip: string | null;
  userAgent: string | null;
}

export interface AuditLogFilters {
  actorEmail?: string;
  entityType?: string;
  method?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogRow {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  method: string;
  entityType: string;
  entityId: string | null;
  statusCode: number;
  success: boolean;
  requestJson: unknown;
  responseJson: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogPage {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

const MAX_PAGE_SIZE = 200;

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Best-effort: nunca deve derrubar a requisição HTTP que originou o log.
   * Erros (ex. base de dados momentaneamente indisponível) só geram um aviso.
   */
  async record(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          actorUserId: entry.actorUserId,
          actorEmail: entry.actorEmail,
          method: entry.method,
          entityType: entry.entityType,
          entityId: entry.entityId,
          statusCode: entry.statusCode,
          success: entry.success,
          requestJson: (sanitizeForAudit(entry.requestBody) ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          responseJson: (sanitizeForAudit(entry.responseBody) ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          ip: entry.ip,
          userAgent: entry.userAgent,
        },
      });
    } catch (e) {
      this.logger.warn(
        `Falha ao gravar audit log (${entry.method} ${entry.entityType}): ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  async list(tenantId: string, filters: AuditLogFilters): Promise<AuditLogPage> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? 50));

    const where: Prisma.AuditLogWhereInput = { tenantId };
    if (filters.actorEmail) {
      where.actorEmail = { contains: filters.actorEmail, mode: 'insensitive' };
    }
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.method) where.method = filters.method.toUpperCase();
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      rows: rows.map((r) => ({
        id: r.id,
        actorUserId: r.actorUserId,
        actorEmail: r.actorEmail,
        method: r.method,
        entityType: r.entityType,
        entityId: r.entityId,
        statusCode: r.statusCode,
        success: r.success,
        requestJson: r.requestJson,
        responseJson: r.responseJson,
        ip: r.ip,
        userAgent: r.userAgent,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** Valores distintos de `entityType` já registados no tenant — alimenta o filtro na UI. */
  async listEntityTypes(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { tenantId },
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' },
    });
    return rows.map((r) => r.entityType);
  }
}
