import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { SsoService } from './sso.service';

@ApiTags('sso')
@Controller('auth/sso')
export class SsoController {
  constructor(private readonly sso: SsoService) {}

  /** Inicia o fluxo OIDC redirecionando para o Authorization Endpoint do provedor do tenant. */
  @Get(':tenantSlug/login')
  async login(
    @Param('tenantSlug') tenantSlug: string,
    @Res({ passthrough: false }) reply: FastifyReply
  ) {
    try {
      const url = await this.sso.buildAuthorizationUrl(tenantSlug);
      reply.redirect(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao iniciar login único.';
      reply.redirect(this.sso.buildCmsErrorRedirectUrl(message));
    }
  }

  /** Callback do provedor OIDC (`redirect_uri`). Devolve o utilizador ao CMS com a sessão no fragmento da URL. */
  @Get('callback')
  async callback(
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: false }) reply: FastifyReply
  ) {
    try {
      const session = await this.sso.handleCallback(query);
      reply.redirect(this.sso.buildCmsRedirectUrl(session));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha no login único.';
      reply.redirect(this.sso.buildCmsErrorRedirectUrl(message));
    }
  }
}
