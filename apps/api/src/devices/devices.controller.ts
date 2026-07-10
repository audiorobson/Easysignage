import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { P } from '../common/permissions';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { DevicesService, DeviceListFilters } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { AssignTestContentDto } from './dto/assign-test-content.dto';
import { PublishDeviceDto } from './dto/publish-device.dto';
import { UpdateDeviceViewportDto } from './dto/update-device-viewport.dto';
import { UpsertDeviceLayoutDto } from './dto/upsert-device-layout.dto';

@ApiTags('devices')
@ApiBearerAuth('access-token')
@Controller('devices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  @RequirePermissions(P.DEVICES_READ)
  list(
    @CurrentUser() user: JwtUser,
    @Query('siteId') siteId?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('online') online?: string
  ) {
    const filters: DeviceListFilters = {};
    if (siteId) filters.siteId = siteId;
    if (platform) filters.platform = platform;
    if (status) filters.status = status;
    if (online === 'true' || online === 'false') filters.online = online;
    return this.devices.list(user.tenantId, filters);
  }

  @Get(':id/state')
  @RequirePermissions(P.DEVICES_READ)
  getState(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.devices.getAdminState(user.tenantId, id);
  }

  @Get(':id')
  @RequirePermissions(P.DEVICES_READ)
  get(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.devices.getById(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(P.DEVICES_WRITE)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateDeviceDto) {
    return this.devices.create(user.tenantId, dto);
  }

  @Patch(':id/test-content')
  @RequirePermissions(P.DEVICES_WRITE)
  assignTestContent(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTestContentDto
  ) {
    return this.devices.assignTestContent(user.tenantId, id, dto);
  }

  @Post(':id/publish')
  @RequirePermissions(P.DEVICES_WRITE)
  publish(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishDeviceDto
  ) {
    return this.devices.publishContent(user.tenantId, id, dto);
  }

  @Get(':id/publications')
  @RequirePermissions(P.DEVICES_READ)
  listPublications(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.devices.listPublications(user.tenantId, id);
  }

  @Patch(':id/viewport')
  @RequirePermissions(P.DEVICES_WRITE)
  updateViewport(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviceViewportDto
  ) {
    return this.devices.updateViewport(user.tenantId, id, dto);
  }

  @Get(':id/layout')
  @RequirePermissions(P.DEVICES_READ)
  getLayout(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.devices.getDeviceLayout(user.tenantId, id);
  }

  @Put(':id/layout')
  @RequirePermissions(P.DEVICES_WRITE)
  upsertLayout(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertDeviceLayoutDto
  ) {
    return this.devices.upsertDeviceLayout(user.tenantId, id, dto);
  }

  @Patch(':id')
  @RequirePermissions(P.DEVICES_WRITE)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviceDto
  ) {
    return this.devices.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(P.DEVICES_WRITE)
  remove(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.devices.remove(user.tenantId, id);
  }

  @Post(':id/pairing-code')
  @RequirePermissions(P.DEVICES_WRITE)
  regeneratePairing(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.devices.regeneratePairing(user.tenantId, id);
  }
}
