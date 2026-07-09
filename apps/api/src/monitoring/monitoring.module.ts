import { Module } from '@nestjs/common';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { MonitoringController } from './monitoring.controller';

@Module({
  imports: [TelemetryModule],
  controllers: [MonitoringController],
})
export class MonitoringModule {}
