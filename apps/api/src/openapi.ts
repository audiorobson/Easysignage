import { DocumentBuilder } from '@nestjs/swagger';

/**
 * Configuração do OpenAPI partilhada entre o bootstrap da API (`main.ts`,
 * endpoint `/docs` + `/openapi.json`) e o script de exportação estático
 * (`scripts/export-openapi.ts`, PR 6.1) que grava `contracts/openapi/openapi.json`.
 */
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('EasySignage API')
    .setDescription(
      'REST do CMS (JWT), rotas públicas de pareamento e API do player (Bearer de device). ' +
        'Especificação evolutiva — alinhar com `digital_signage_arquitetura_roadmap.md`.'
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token'
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'device-token'
    )
    .addTag('auth', 'Login e sessão')
    .addTag('sites', 'Espaços (sites)')
    .addTag('devices', 'Dispositivos / publicação / pareamento')
    .addTag('assets', 'Biblioteca de média')
    .addTag('playlists', 'Playlists')
    .addTag('groups', 'Grupos de dispositivos')
    .addTag('public', 'Pareamento público (sem JWT de utilizador)')
    .addTag('device', 'Player autenticado (token de device)')
    .addTag('health', 'Saúde do serviço')
    .build();
}
