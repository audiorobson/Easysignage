import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { P } from '../common/permissions';
import { ReleasesService } from './releases.service';
import { CreateReleaseDto } from './dto/create-release.dto';

/**
 * Catálogo de releases dos players nativos (Fase 5.C, PR 5.13). Endpoint admin
 * (CMS); o próprio player consulta a versão via `GET /device/releases/latest`
 * (device-api, autenticado com token de dispositivo).
 */
@ApiTags('releases')
@ApiBearerAuth('access-token')
@Controller('releases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get()
  @RequirePermissions(P.SETTINGS_READ)
  list(@Query('product') product?: string) {
    return this.releases.list(product);
  }

  @Post()
  @RequirePermissions(P.SETTINGS_WRITE)
  create(@Body() dto: CreateReleaseDto) {
    return this.releases.create(dto);
  }
}
