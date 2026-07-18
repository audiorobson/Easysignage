import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicController } from './public.controller';

@Module({
  imports: [DevicesModule, PrismaModule],
  controllers: [PublicController],
})
export class PublicModule {}
