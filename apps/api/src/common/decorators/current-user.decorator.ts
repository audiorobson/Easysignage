import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type JwtUser = {
  userId: string;
  tenantId: string;
  email: string;
  /** Permissões efetivas; `*` = todas (admin) */
  permissions: string[];
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as JwtUser;
  }
);
