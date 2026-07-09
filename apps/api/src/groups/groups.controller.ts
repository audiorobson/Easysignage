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

import { GroupsService } from './groups.service';

import { CreateGroupDto } from './dto/create-group.dto';

import { UpdateGroupDto } from './dto/update-group.dto';

import { AddGroupMembersDto } from './dto/add-group-members.dto';

import { AssignTestContentDto } from '../devices/dto/assign-test-content.dto';

import { PublishDeviceDto } from '../devices/dto/publish-device.dto';



@ApiTags('groups')

@ApiBearerAuth('access-token')

@Controller('groups')

@UseGuards(JwtAuthGuard, PermissionsGuard)

export class GroupsController {

  constructor(private readonly groups: GroupsService) {}



  @Get()

  @RequirePermissions(P.GROUPS_READ)

  list(@CurrentUser() user: JwtUser) {

    return this.groups.list(user.tenantId);

  }



  @Post()

  @RequirePermissions(P.GROUPS_WRITE)

  create(@CurrentUser() user: JwtUser, @Body() dto: CreateGroupDto) {

    return this.groups.create(user.tenantId, dto);

  }



  @Get(':id')

  @RequirePermissions(P.GROUPS_READ)

  get(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {

    return this.groups.getById(user.tenantId, id);

  }



  @Patch(':id')

  @RequirePermissions(P.GROUPS_WRITE)

  update(

    @CurrentUser() user: JwtUser,

    @Param('id', ParseUUIDPipe) id: string,

    @Body() dto: UpdateGroupDto

  ) {

    return this.groups.update(user.tenantId, id, dto);

  }



  @Delete(':id')

  @RequirePermissions(P.GROUPS_WRITE)

  remove(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {

    return this.groups.remove(user.tenantId, id);

  }



  @Post(':id/members')

  @RequirePermissions(P.GROUPS_WRITE)

  addMembers(

    @CurrentUser() user: JwtUser,

    @Param('id', ParseUUIDPipe) id: string,

    @Body() dto: AddGroupMembersDto

  ) {

    return this.groups.addMembers(user.tenantId, id, dto.deviceIds);

  }



  @Delete(':id/members/:deviceId')

  @RequirePermissions(P.GROUPS_WRITE)

  removeMember(

    @CurrentUser() user: JwtUser,

    @Param('id', ParseUUIDPipe) id: string,

    @Param('deviceId', ParseUUIDPipe) deviceId: string

  ) {

    return this.groups.removeMember(user.tenantId, id, deviceId);

  }



  @Post(':id/test-content')

  @RequirePermissions(P.GROUPS_WRITE)

  assignTestContent(

    @CurrentUser() user: JwtUser,

    @Param('id', ParseUUIDPipe) id: string,

    @Body() dto: AssignTestContentDto

  ) {

    return this.groups.assignTestContentToGroup(user.tenantId, id, dto);

  }



  @Post(':id/publish')

  @RequirePermissions(P.GROUPS_WRITE)

  publish(

    @CurrentUser() user: JwtUser,

    @Param('id', ParseUUIDPipe) id: string,

    @Body() dto: PublishDeviceDto

  ) {

    return this.groups.publishToGroup(user.tenantId, id, dto);

  }

}

