import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { P } from '../common/permissions';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('roles')
  @RequirePermissions(P.SETTINGS_READ)
  listRoles(@CurrentUser() user: JwtUser) {
    return this.users.listRoles(user.tenantId);
  }

  @Get()
  @RequirePermissions(P.SETTINGS_READ)
  list(@CurrentUser() user: JwtUser) {
    return this.users.list(user.tenantId);
  }

  @Post()
  @RequirePermissions(P.SETTINGS_WRITE)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateUserDto) {
    return this.users.create(user.tenantId, dto);
  }
}
