import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { appConfig } from './config';

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[process] uncaughtException', error);
});

console.log('[boot] Loading NestJS application...');

async function bootstrap() {
  const { port, nodeEnv } = appConfig();
  console.log('[boot] Config', {
    port,
    nodeEnv,
    databaseUrl: process.env.DATABASE_URL ? 'set' : 'MISSING',
  });

  if (!process.env.DATABASE_URL) {
    console.error(
      '[boot] FATAL: DATABASE_URL is not set. On Railway: Variables → Add Reference → Postgres.DATABASE_URL',
    );
    process.exit(1);
  }

  console.log('[boot] Connecting to database (may take a few seconds)...');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  console.log('[boot] Nest application created');
  app.set('trust proxy', 1);
  app.useGlobalFilters(new HttpExceptionFilter());

  const { corsOrigin } = appConfig();
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-request-id'],
  });

  // Railway routes public traffic to process.env.PORT — must bind 0.0.0.0
  await app.listen(port, '0.0.0.0');

  const address = app.getHttpServer().address();
  console.log('[boot] Server listening', { port, address });
}

bootstrap().catch((error) => {
  console.error('[boot] Fatal startup error:', error);
  process.exit(1);
});
