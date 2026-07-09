import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Device, Site } from '../../generated/prisma-client';

export type DeviceWithSite = Device & { site: Site };

export const CurrentDevice = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DeviceWithSite => {
    const req = ctx.switchToHttp().getRequest();
    return req.device as DeviceWithSite;
  }
);
