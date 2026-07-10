import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { P } from '../common/permissions';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { VideoWallsService } from './video-walls.service';
import {
  CreateVideoWallDto,
  SetWallTilesDto,
  UpdateVideoWallDto,
} from './dto/video-wall.dto';

@ApiTags('video-walls')
@ApiBearerAuth('access-token')
@Controller('video-walls')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VideoWallsController {
  constructor(private readonly walls: VideoWallsService) {}

  @Get()
  @RequirePermissions(P.DEVICES_READ)
  list(@CurrentUser() user: JwtUser) {
    return this.walls.list(user.tenantId);
  }

  @Get(':id/health')
  @RequirePermissions(P.DEVICES_READ)
  health(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.walls.getSyncHealth(user.tenantId, id);
  }

  @Get(':id')
  @RequirePermissions(P.DEVICES_READ)
  get(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.walls.getById(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(P.DEVICES_WRITE)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateVideoWallDto) {
    return this.walls.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(P.DEVICES_WRITE)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVideoWallDto
  ) {
    return this.walls.update(user.tenantId, id, dto);
  }

  @Put(':id/tiles')
  @RequirePermissions(P.DEVICES_WRITE)
  setTiles(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetWallTilesDto
  ) {
    return this.walls.setTiles(user.tenantId, id, dto);
  }

  @Post(':id/publish')
  @RequirePermissions(P.DEVICES_WRITE)
  publish(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.walls.publish(user.tenantId, id);
  }

  @Post(':id/sync')
  @RequirePermissions(P.DEVICES_WRITE)
  sync(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.walls.sync(user.tenantId, id);
  }
}
