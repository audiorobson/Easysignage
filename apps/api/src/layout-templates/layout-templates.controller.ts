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
import { LayoutTemplatesService } from './layout-templates.service';
import { CreateLayoutTemplateDto } from './dto/create-layout-template.dto';
import { UpdateLayoutTemplateDto } from './dto/update-layout-template.dto';

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

  @Get(':id')
  @RequirePermissions(P.DEVICES_READ)
  getOne(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.templates.getOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(P.DEVICES_WRITE)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateLayoutTemplateDto) {
    return this.templates.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(P.DEVICES_WRITE)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLayoutTemplateDto
  ) {
    return this.templates.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(P.DEVICES_WRITE)
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.templates.remove(user.tenantId, id);
  }
}
