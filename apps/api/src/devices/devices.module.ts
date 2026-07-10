import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VideoWallsModule } from '../video-walls/video-walls.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [AuthModule, VideoWallsModule],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
