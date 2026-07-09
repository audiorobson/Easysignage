import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtUser } from '../common/decorators/current-user.decorator';

type JwtPayload = {
  sub: string;
  tenantId: string;
  email: string;
  permissions?: string[];
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET não configurado');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): JwtUser {
    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException();
    }
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    };
  }
}
