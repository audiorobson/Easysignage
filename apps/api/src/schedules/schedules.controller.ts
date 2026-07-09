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
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { UpdateScheduleRuleDto } from './dto/update-schedule-rule.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('schedules')
@ApiBearerAuth('access-token')
@Controller('schedules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  @RequirePermissions(P.SCHEDULING_READ)
  list(@CurrentUser() user: JwtUser) {
    return this.schedules.list(user.tenantId);
  }

  @Post('reapply')
  @RequirePermissions(P.SCHEDULING_WRITE)
  reapplyAll(@CurrentUser() user: JwtUser) {
    return this.schedules.reapplyAll(user.tenantId);
  }

  @Get(':id')
  @RequirePermissions(P.SCHEDULING_READ)
  get(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.schedules.getById(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(P.SCHEDULING_WRITE)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateScheduleRuleDto) {
    return this.schedules.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(P.SCHEDULING_WRITE)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleRuleDto
  ) {
    return this.schedules.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(P.SCHEDULING_WRITE)
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.schedules.remove(user.tenantId, id);
  }

}
