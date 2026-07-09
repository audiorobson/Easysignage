import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { hashToken } from '../crypto';

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers?.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de dispositivo obrigatório');
    }
    const raw = auth.slice(7);
    const tokenHash = hashToken(raw);
    const device = await this.prisma.device.findFirst({
      where: { authTokenHash: tokenHash, status: 'active' },
      include: { site: true },
    });
    if (!device) {
      throw new UnauthorizedException('Dispositivo inválido');
    }
    req.device = device;
    return true;
  }
}
