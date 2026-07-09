import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { P } from '../common/permissions';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@ApiTags('assets')
@ApiBearerAuth('access-token')
@Controller('assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  @RequirePermissions(P.ASSETS_READ)
  list(
    @CurrentUser() user: JwtUser,
    @Query('kind') kind?: string
  ) {
    return this.assets.list(user.tenantId, kind);
  }

  @Post('upload')
  @RequirePermissions(P.ASSETS_WRITE)
  uploadMultipart(
    @CurrentUser() user: JwtUser,
    @Req() req: FastifyRequest
  ) {
    return this.assets.createFromMultipart(user.tenantId, req);
  }

  @Post()
  @RequirePermissions(P.ASSETS_WRITE)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateAssetDto) {
    return this.assets.create(user.tenantId, dto);
  }

  @Get(':id/thumbnail')
  @RequirePermissions(P.ASSETS_READ)
  async thumbnail(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) reply: FastifyReply
  ) {
    await this.assets.streamThumbnailForTenant(user.tenantId, id, reply);
  }

  /** Metadados do asset — alinhado a `GET /device/assets/:id/meta` (pré-visualização CMS). */
  @Get(':id/meta')
  @RequirePermissions(P.ASSETS_READ)
  assetMeta(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.assets.getMetaForTenant(user.tenantId, id);
  }

  /** Stream ou redirecionamento para URL externa — alinhado ao device player. */
  @Get(':id/file')
  @RequirePermissions(P.ASSETS_READ)
  async assetFile(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) reply: FastifyReply
  ) {
    await this.assets.sendFileForDevice(user.tenantId, id, reply);
  }

  @Patch(':id')
  @RequirePermissions(P.ASSETS_WRITE)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto
  ) {
    return this.assets.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(P.ASSETS_WRITE)
  async remove(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    await this.assets.remove(user.tenantId, id);
  }
}
