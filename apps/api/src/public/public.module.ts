import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { PublicController } from './public.controller';

@Module({
  imports: [DevicesModule],
  controllers: [PublicController],
})
export class PublicModule {}
