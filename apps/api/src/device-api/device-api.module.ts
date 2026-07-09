import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { PlaylistsModule } from '../playlists/playlists.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { DeviceApiController } from './device-api.controller';

@Module({
  imports: [AssetsModule, PlaylistsModule, SchedulesModule, TelemetryModule],
  controllers: [DeviceApiController],
})
export class DeviceApiModule {}
