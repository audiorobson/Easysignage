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
import { PlaylistsService } from './playlists.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { CreatePlaylistItemDto } from './dto/create-playlist-item.dto';
import { UpdatePlaylistItemDto } from './dto/update-playlist-item.dto';
import { ReorderPlaylistDto } from './dto/reorder-playlist.dto';

@ApiTags('playlists')
@ApiBearerAuth('access-token')
@Controller('playlists')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlaylistsController {
  constructor(private readonly playlists: PlaylistsService) {}

  @Get()
  @RequirePermissions(P.PLAYLISTS_READ)
  list(@CurrentUser() user: JwtUser) {
    return this.playlists.list(user.tenantId);
  }

  @Post()
  @RequirePermissions(P.PLAYLISTS_WRITE)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreatePlaylistDto) {
    return this.playlists.create(user.tenantId, dto);
  }

  /** Rotas mais específicas antes de `:id` genérico */
  @Post(':id/reorder')
  @RequirePermissions(P.PLAYLISTS_WRITE)
  reorder(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderPlaylistDto
  ) {
    return this.playlists.reorder(user.tenantId, id, dto.orderedItemIds);
  }

  @Post(':id/items')
  @RequirePermissions(P.PLAYLISTS_WRITE)
  addItem(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePlaylistItemDto
  ) {
    return this.playlists.addItem(user.tenantId, id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions(P.PLAYLISTS_WRITE)
  updateItem(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdatePlaylistItemDto
  ) {
    return this.playlists.updateItem(user.tenantId, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions(P.PLAYLISTS_WRITE)
  removeItem(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string
  ) {
    return this.playlists.removeItem(user.tenantId, id, itemId);
  }

  /** Manifesto de reprodução (mesmo formato que `GET /device/playlists/:id/manifest`) — pré-visualização CMS. */
  @Get(':id/manifest')
  @RequirePermissions(P.PLAYLISTS_READ)
  manifest(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.playlists.getManifestForDevice(user.tenantId, id);
  }

  @Get(':id')
  @RequirePermissions(P.PLAYLISTS_READ)
  get(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.playlists.getById(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(P.PLAYLISTS_WRITE)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlaylistDto
  ) {
    return this.playlists.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(P.PLAYLISTS_WRITE)
  remove(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.playlists.remove(user.tenantId, id);
  }
}
