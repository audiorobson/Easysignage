import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogController } from './audit-log.controller';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditLogService } from './audit-log.service';

/**
 * Fase 6, PR 6.2 — trilha de auditoria. O interceptor é registado globalmente
 * (`APP_INTERCEPTOR`) para cobrir toda mutação feita por um utilizador CMS,
 * sem precisar de decorators em cada controller.
 */
@Module({
  controllers: [AuditLogController],
  providers: [
    AuditLogService,
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
  exports: [AuditLogService],
})
export class AuditModule {}
