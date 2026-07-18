import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { P } from '../common/permissions';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { SettingsService } from './settings.service';
import { UpdateAlertNotificationsDto } from './dto/update-alert-notifications.dto';

@ApiTags('settings')
@ApiBearerAuth('access-token')
@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Config de notificações de alerta (webhook + e-mail) do tenant autenticado (PR 5.18). */
  @Get('notifications')
  @RequirePermissions(P.SETTINGS_READ)
  getAlertNotifications(@CurrentUser() user: JwtUser) {
    return this.settings.getAlertNotifications(user.tenantId);
  }

  @Patch('notifications')
  @RequirePermissions(P.SETTINGS_WRITE)
  updateAlertNotifications(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateAlertNotificationsDto
  ) {
    return this.settings.updateAlertNotifications(user.tenantId, dto);
  }
}
