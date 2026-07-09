import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { DevicesModule } from '../devices/devices.module';

import { GroupsController } from './groups.controller';

import { GroupsService } from './groups.service';



@Module({

  imports: [AuthModule, DevicesModule],

  controllers: [GroupsController],

  providers: [GroupsService],

})

export class GroupsModule {}

