import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DevicesService } from '../devices/devices.service';
import { PrismaService } from '../prisma/prisma.service';
import { PairDeviceDto } from './dto/pair-device.dto';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly devices: DevicesService,
    private readonly prisma: PrismaService
  ) {}

  @Post('devices/pair')
  pair(@Body() dto: PairDeviceDto) {
    return this.devices.pair({
      pairingCode: dto.pairingCode,
      name: dto.name,
      platform: dto.platform,
      runtimeVersion: dto.runtimeVersion,
    });
  }

  /**
   * Branding público de um tenant por `slug` (PR 6.6) — sem autenticação, usado na tela de
   * login antes de haver sessão. Devolve apenas campos seguros para exibição (nunca segredos).
   */
  @Get('tenants/:slug/branding')
  async getTenantBranding(@Param('slug') slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { name: true, brandName: true, brandLogoUrl: true, brandPrimaryColor: true },
    });
    if (!tenant) {
      return { name: null, brandName: null, brandLogoUrl: null, brandPrimaryColor: null };
    }
    return tenant;
  }
}
