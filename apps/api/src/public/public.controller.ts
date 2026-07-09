import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DevicesService } from '../devices/devices.service';
import { PairDeviceDto } from './dto/pair-device.dto';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly devices: DevicesService) {}

  @Post('devices/pair')
  pair(@Body() dto: PairDeviceDto) {
    return this.devices.pair({
      pairingCode: dto.pairingCode,
      name: dto.name,
      platform: dto.platform,
      runtimeVersion: dto.runtimeVersion,
    });
  }
}
