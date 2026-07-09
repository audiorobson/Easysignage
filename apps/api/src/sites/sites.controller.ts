import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { P } from '../common/permissions';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@ApiTags('sites')
@ApiBearerAuth('access-token')
@Controller('sites')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  @RequirePermissions(P.SITES_READ)
  list(@CurrentUser() user: JwtUser) {
    return this.sites.list(user.tenantId);
  }

  @Get(':id')
  @RequirePermissions(P.SITES_READ)
  get(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.sites.getById(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(P.SITES_WRITE)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateSiteDto) {
    return this.sites.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(P.SITES_WRITE)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiteDto
  ) {
    return this.sites.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(P.SITES_WRITE)
  remove(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sites.remove(user.tenantId, id);
  }
}
