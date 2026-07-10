import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VideoWallsController } from './video-walls.controller';
import { VideoWallsService } from './video-walls.service';

@Module({
  imports: [AuthModule],
  controllers: [VideoWallsController],
  providers: [VideoWallsService],
  exports: [VideoWallsService],
})
export class VideoWallsModule {}
