import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { P } from '../common/permissions';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@ApiTags('audit')
@ApiBearerAuth('access-token')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  @RequirePermissions(P.AUDIT_READ)
  list(@CurrentUser() user: JwtUser, @Query() query: AuditLogQueryDto) {
    return this.auditLog.list(user.tenantId, query);
  }

  @Get('entity-types')
  @RequirePermissions(P.AUDIT_READ)
  entityTypes(@CurrentUser() user: JwtUser) {
    return this.auditLog.listEntityTypes(user.tenantId);
  }
}
