import { Module } from '@nestjs/common';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { PlaybackModule } from '../playback/playback.module';
import { MonitoringController } from './monitoring.controller';

@Module({
  imports: [TelemetryModule, PlaybackModule],
  controllers: [MonitoringController],
})
export class MonitoringModule {}
