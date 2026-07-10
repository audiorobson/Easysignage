import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DevicesModule } from '../devices/devices.module';
import { VideoWallsModule } from '../video-walls/video-walls.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { ScheduleEngineService } from './schedule-engine.service';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [
    PrismaModule,
    DevicesModule,
    VideoWallsModule,
    forwardRef(() => CampaignsModule),
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService, ScheduleEngineService],
  exports: [SchedulesService, ScheduleEngineService],
})
export class SchedulesModule {}
