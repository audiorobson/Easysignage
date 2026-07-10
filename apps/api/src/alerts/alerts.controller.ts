import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { P } from '../common/permissions';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@ApiBearerAuth('access-token')
@Controller('alerts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @RequirePermissions(P.ALERTS_READ)
  list(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string
  ) {
    return this.alerts.list(user.tenantId, status);
  }

  @Get('summary')
  @RequirePermissions(P.ALERTS_READ)
  summary(@CurrentUser() user: JwtUser) {
    return this.alerts.summary(user.tenantId);
  }

  @Post('evaluate')
  @RequirePermissions(P.ALERTS_WRITE)
  evaluate(@CurrentUser() user: JwtUser) {
    return this.alerts.evaluateTenant(user.tenantId);
  }

  @Patch(':id/ack')
  @RequirePermissions(P.ALERTS_WRITE)
  async ack(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const row = await this.alerts.acknowledge(user.tenantId, user.userId, id);
    if (!row) throw new NotFoundException('Alerta não encontrado');
    return row;
  }
}
