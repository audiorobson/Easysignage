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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { P } from '../common/permissions';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@ApiTags('campaigns')
@ApiBearerAuth('access-token')
@Controller('campaigns')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @RequirePermissions(P.CAMPAIGNS_READ)
  list(@CurrentUser() user: JwtUser) {
    return this.campaigns.list(user.tenantId);
  }

  @Post('reapply')
  @RequirePermissions(P.CAMPAIGNS_WRITE)
  reapplyAll(@CurrentUser() user: JwtUser) {
    return this.campaigns.reapplyAll(user.tenantId);
  }

  @Get(':id')
  @RequirePermissions(P.CAMPAIGNS_READ)
  get(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.campaigns.getById(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(P.CAMPAIGNS_WRITE)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(user.tenantId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions(P.CAMPAIGNS_WRITE)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto
  ) {
    return this.campaigns.update(user.tenantId, id, dto);
  }

  @Post(':id/activate')
  @RequirePermissions(P.CAMPAIGNS_WRITE)
  activate(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.campaigns.setStatus(user.tenantId, id, 'active');
  }

  @Post(':id/pause')
  @RequirePermissions(P.CAMPAIGNS_WRITE)
  pause(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.campaigns.setStatus(user.tenantId, id, 'paused');
  }

  @Post(':id/end')
  @RequirePermissions(P.CAMPAIGNS_WRITE)
  end(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.campaigns.setStatus(user.tenantId, id, 'ended');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(P.CAMPAIGNS_WRITE)
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.campaigns.remove(user.tenantId, id);
  }
}
