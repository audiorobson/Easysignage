import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AssetsModule } from './assets/assets.module';
import { DeviceApiModule } from './device-api/device-api.module';
import { DevicesModule } from './devices/devices.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { PublicModule } from './public/public.module';
import { SitesModule } from './sites/sites.module';
import { GroupsModule } from './groups/groups.module';
import { SchedulesModule } from './schedules/schedules.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { LayoutTemplatesModule } from './layout-templates/layout-templates.module';
import { VideoWallsModule } from './video-walls/video-walls.module';
import { RealtimeModule } from './realtime/realtime.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { AlertsModule } from './alerts/alerts.module';
import { LicenseModule } from './license/license.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    LicenseModule,
    RealtimeModule,
    AuthModule,
    SitesModule,
    AssetsModule,
    PlaylistsModule,
    DevicesModule,
    GroupsModule,
    SchedulesModule,
    CampaignsModule,
    AlertsModule,
    MonitoringModule,
    LayoutTemplatesModule,
    VideoWallsModule,
    PublicModule,
    DeviceApiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
