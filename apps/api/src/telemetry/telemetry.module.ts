import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DevicePreviewService } from './device-preview.service';
import { TelemetryService } from './telemetry.service';
import { WolService } from './wol.service';

@Module({
  imports: [PrismaModule],
  providers: [TelemetryService, WolService, DevicePreviewService],
  exports: [TelemetryService, WolService, DevicePreviewService],
})
export class TelemetryModule {}
