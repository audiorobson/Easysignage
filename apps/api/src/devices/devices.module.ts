import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LicenseModule } from '../license/license.module';
import { VideoWallsModule } from '../video-walls/video-walls.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [AuthModule, LicenseModule, VideoWallsModule],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
