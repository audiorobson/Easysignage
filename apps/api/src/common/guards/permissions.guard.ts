import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { JwtUser } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );
    if (!required?.length) {
      throw new ForbiddenException(
        'Rota protegida sem permissões configuradas (RequirePermissions)'
      );
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user as JwtUser | undefined;
    const perms = user?.permissions ?? [];

    if (perms.includes('*')) return true;
    const ok = required.every((p) => perms.includes(p));
    if (!ok) {
      throw new ForbiddenException('Permissão insuficiente');
    }
    return true;
  }
}
