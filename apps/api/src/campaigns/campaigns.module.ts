import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { CampaignEngineService } from './campaign-engine.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [PrismaModule, forwardRef(() => SchedulesModule)],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignEngineService],
  exports: [CampaignsService, CampaignEngineService],
})
export class CampaignsModule {}
