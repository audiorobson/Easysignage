import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { mergeRolePermissions } from '../common/permissions';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async login(tenantSlug: string, email: string, password: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant || tenant.status !== 'active') {
      throw new UnauthorizedException('Tenant inválido');
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: email.toLowerCase() } },
      include: {
        userRoles: { include: { role: true } },
      },
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const permissions = mergeRolePermissions(
      user.userRoles.map((ur) => ur.role)
    );

    const token = await this.jwt.signAsync({
      sub: user.id,
      tenantId: tenant.id,
      email: user.email,
      permissions,
    });

    return {
      accessToken: token,
      tokenType: 'Bearer' as const,
      expiresIn: 604800,
      user: { id: user.id, name: user.name, email: user.email },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    };
  }
}
