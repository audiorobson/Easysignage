import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { P } from '../common/permissions';
import { LicenseService } from './license.service';
import { ApplyLicenseDto } from './dto/apply-license.dto';

@ApiTags('license')
@Controller('license')
export class LicenseController {
  constructor(private readonly license: LicenseService) {}

  /** Estado da licença (público para setup inicial — sem auth). */
  @Get('status')
  status() {
    return this.license.getStatus();
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('apply')
  @RequirePermissions(P.SETTINGS_WRITE)
  apply(@Body() dto: ApplyLicenseDto) {
    return this.license.applyLicenseKey(dto.licenseKey);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('refresh')
  @RequirePermissions(P.SETTINGS_READ)
  refresh() {
    return this.license.refreshFromEnvironment();
  }
}
