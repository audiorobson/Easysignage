import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { P } from '../common/permissions';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { SettingsService } from './settings.service';
import { UpdateAlertNotificationsDto } from './dto/update-alert-notifications.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateSsoConfigDto } from './dto/update-sso-config.dto';

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

  /** Configuração de SSO OIDC do tenant autenticado (PR 6.4). */
  @Get('sso')
  @RequirePermissions(P.SETTINGS_READ)
  getSsoConfig(@CurrentUser() user: JwtUser) {
    return this.settings.getSsoConfig(user.tenantId);
  }

  @Patch('sso')
  @RequirePermissions(P.SETTINGS_WRITE)
  updateSsoConfig(@CurrentUser() user: JwtUser, @Body() dto: UpdateSsoConfigDto) {
    return this.settings.updateSsoConfig(user.tenantId, dto);
  }

  /** Uso atual de quotas do plano (dispositivos/utilizadores) — PR 6.5. */
  @Get('quota')
  @RequirePermissions(P.SETTINGS_READ)
  getQuotaUsage(@CurrentUser() user: JwtUser) {
    return this.settings.getQuotaUsage(user.tenantId);
  }

  /** Branding do tenant (logo/cor/nome) — PR 6.6. */
  @Get('branding')
  @RequirePermissions(P.SETTINGS_READ)
  getBranding(@CurrentUser() user: JwtUser) {
    return this.settings.getBranding(user.tenantId);
  }

  @Patch('branding')
  @RequirePermissions(P.SETTINGS_WRITE)
  updateBranding(@CurrentUser() user: JwtUser, @Body() dto: UpdateBrandingDto) {
    return this.settings.updateBranding(user.tenantId, dto);
  }
}
