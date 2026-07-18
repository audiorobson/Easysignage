import { config } from 'dotenv';
config();

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildSwaggerConfig } from './openapi';
import multipart from '@fastify/multipart';

/** CORS: use CORS_ORIGINS no .env (lista separada por vírgula). */
/** Limite do corpo (Fastify default ~1MB). Upload de imagem em JSON base64 precisa mais. */
/** Upload base64 de vídeo/PDF: aumentar via BODY_LIMIT_BYTES no .env se necessário */
const BODY_LIMIT_BYTES =
  Number(process.env.BODY_LIMIT_BYTES) || 100 * 1024 * 1024;

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: BODY_LIMIT_BYTES })
  );

  app.setGlobalPrefix('api/v1');

  const fastify = app.getHttpAdapter().getInstance();
  /* Nest 10 + @nestjs/platform-fastify usa Fastify 4 — @fastify/multipart 8.x é a linha compatível. */
  await fastify.register(multipart, {
    limits: { fileSize: BODY_LIMIT_BYTES },
  });

  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin =
    corsOrigins?.length === 1
      ? corsOrigins[0]
      : corsOrigins?.length
        ? corsOrigins
        : process.env.CMS_ORIGIN ?? true;

  app.enableCors({
    origin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  /** OpenAPI (§19.0.1 roadmap): desativar em produção com `SWAGGER=0`. */
  if (process.env.SWAGGER !== '0') {
    const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
      jsonDocumentUrl: '/openapi.json',
    });
  }

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on ${port}`);
  if (process.env.SWAGGER !== '0') {
    console.log(`OpenAPI UI: http://0.0.0.0:${port}/docs`);
  }
}

bootstrap();
