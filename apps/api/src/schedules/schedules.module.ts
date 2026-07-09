import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleEngineService } from './schedule-engine.service';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [PrismaModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, ScheduleEngineService],
  exports: [SchedulesService, ScheduleEngineService],
})
export class SchedulesModule {}
