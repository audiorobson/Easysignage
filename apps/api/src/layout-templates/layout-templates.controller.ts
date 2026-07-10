import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { P } from '../common/permissions';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { LayoutTemplatesService } from './layout-templates.service';

@ApiTags('layout-templates')
@ApiBearerAuth('access-token')
@Controller('layout-templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LayoutTemplatesController {
  constructor(private readonly templates: LayoutTemplatesService) {}

  @Get()
  @RequirePermissions(P.DEVICES_READ)
  list(@CurrentUser() user: JwtUser) {
    return this.templates.list(user.tenantId);
  }
}
