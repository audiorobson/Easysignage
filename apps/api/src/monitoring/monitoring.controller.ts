import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { P } from '../common/permissions';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { DevicePreviewService } from '../telemetry/device-preview.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { EnqueueCommandDto } from './dto/enqueue-command.dto';

@ApiTags('monitoring')
@ApiBearerAuth('access-token')
@Controller('monitoring')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MonitoringController {
  constructor(
    private readonly telemetry: TelemetryService,
    private readonly devicePreview: DevicePreviewService
  ) {}

  @Get('overview')
  @RequirePermissions(P.MONITORING_READ)
  overview(@CurrentUser() user: JwtUser) {
    return this.telemetry.overviewForTenant(user.tenantId);
  }

  @Get('devices/:deviceId/preview')
  @Header('Cache-Control', 'private, no-store, must-revalidate')
  @RequirePermissions(P.MONITORING_READ)
  async devicePreviewImage(
    @CurrentUser() user: JwtUser,
    @Param('deviceId', ParseUUIDPipe) deviceId: string
  ) {
    const { path, key } = await this.devicePreview.assertPreviewReadable(
      user.tenantId,
      deviceId
    );
    const stream = this.devicePreview.getReadStream(path);
    const type = key.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return new StreamableFile(stream, { type });
  }

  @Get('devices/:deviceId')
  @RequirePermissions(P.MONITORING_READ)
  async deviceDetail(
    @CurrentUser() user: JwtUser,
    @Param('deviceId', ParseUUIDPipe) deviceId: string
  ) {
    const row = await this.telemetry.getDeviceSnapshot(user.tenantId, deviceId);
    if (!row) throw new NotFoundException('Device não encontrado');
    return row;
  }

  @Get('devices/:deviceId/events')
  @RequirePermissions(P.MONITORING_READ)
  deviceEvents(
    @CurrentUser() user: JwtUser,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Query('limit') limitStr?: string
  ) {
    const n = limitStr ? parseInt(limitStr, 10) : 80;
    const limit = Number.isFinite(n) ? n : 80;
    return this.telemetry.listEvents(user.tenantId, deviceId, limit);
  }

  @Get('devices/:deviceId/commands')
  @RequirePermissions(P.MONITORING_READ)
  deviceCommands(
    @CurrentUser() user: JwtUser,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Query('limit') limitStr?: string
  ) {
    const n = limitStr ? parseInt(limitStr, 10) : 40;
    const limit = Number.isFinite(n) ? n : 40;
    return this.telemetry.listCommandsForDevice(user.tenantId, deviceId, limit);
  }

  @Post('devices/:deviceId/commands')
  @RequirePermissions(P.MONITORING_WRITE)
  enqueueCommand(
    @CurrentUser() user: JwtUser,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() dto: EnqueueCommandDto
  ) {
    return this.telemetry.enqueueCommand(
      user.tenantId,
      deviceId,
      dto.channel,
      dto.payload
    );
  }
}
