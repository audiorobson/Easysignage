/**
 * PR 6.1 — exporta o documento OpenAPI gerado pelo `@nestjs/swagger` para um
 * ficheiro estático versionável em `contracts/openapi/openapi.json`.
 *
 * Uso: `pnpm --filter @easysignage/api build && pnpm --filter @easysignage/api export:openapi`
 * (ou `pnpm --filter @easysignage/api export:openapi:dev`, que já inclui o build).
 *
 * Corre a partir do JS compilado (`dist/`), **não** via `tsx`: o `emitDecoratorMetadata`
 * do Nest (usado pela injeção de dependências) não é suportado de forma fiável pelo
 * transform baseado em esbuild do `tsx`, o que faz providers como `RealtimeService`
 * receberem `undefined` no lugar do `ConfigService` injetado.
 *
 * Não abre porta HTTP nem liga a Postgres/Redis de facto: `NestFactory.create()` não
 * corre os hooks `onModuleInit` (isso só acontece em `app.init()`/`app.listen()`),
 * e a geração do documento Swagger depende apenas dos metadados dos
 * controllers/DTOs já carregados em memória.
 */
import { config } from 'dotenv';
config();

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { SwaggerModule } from '@nestjs/swagger';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../app.module';
import { buildSwaggerConfig } from '../openapi';

const OUTPUT_PATH = resolve(__dirname, '../../../../contracts/openapi/openapi.json');

/**
 * Validação estrutural leve (não é um validador de schema OpenAPI completo,
 * mas cobre os campos que quebrariam silenciosamente se o Swagger falhasse
 * em introspetar os controllers): versão, info, e pelo menos uma rota.
 */
export function assertValidOpenApiDocument(document: unknown): void {
  if (!document || typeof document !== 'object') {
    throw new Error('Documento OpenAPI inválido: não é um objeto.');
  }
  const doc = document as Record<string, unknown>;
  if (typeof doc.openapi !== 'string' || !doc.openapi.startsWith('3.')) {
    throw new Error(`Documento OpenAPI inválido: campo "openapi" ausente ou inesperado (${doc.openapi}).`);
  }
  const info = doc.info as Record<string, unknown> | undefined;
  if (!info || typeof info.title !== 'string' || !info.title) {
    throw new Error('Documento OpenAPI inválido: "info.title" ausente.');
  }
  const paths = doc.paths as Record<string, unknown> | undefined;
  if (!paths || Object.keys(paths).length === 0) {
    throw new Error('Documento OpenAPI inválido: "paths" vazio — Swagger não introspetou nenhum controller.');
  }
  const components = doc.components as Record<string, unknown> | undefined;
  const securitySchemes = components?.securitySchemes as Record<string, unknown> | undefined;
  if (!securitySchemes || Object.keys(securitySchemes).length === 0) {
    throw new Error('Documento OpenAPI inválido: "components.securitySchemes" vazio.');
  }
}

async function main() {
  const app = await NestFactory.create(AppModule, new FastifyAdapter(), {
    logger: false,
  });
  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());

  assertValidOpenApiDocument(document);

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(document, null, 2)}\n`, 'utf-8');

  const pathCount = Object.keys(document.paths ?? {}).length;
  console.log(`OpenAPI exportado para ${OUTPUT_PATH} (${pathCount} rotas).`);

  /**
   * Sai imediatamente em vez de `await app.close()`: os providers de fila
   * (BullMQ/ioredis em `MediaQueueService`) têm uma condição de corrida
   * conhecida no encerramento (disconnect() vs. cleanup assíncrono interno do
   * BullMQ) que gera um "Connection is closed" não tratado. Este script nunca
   * chega a usar Redis/Postgres (não há `app.init()`/`app.listen()`), por isso
   * não há nada para drenar — só código de saída.
   */
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Falha ao exportar OpenAPI:', err);
    process.exitCode = 1;
  });
}
