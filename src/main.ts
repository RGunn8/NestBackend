import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { appConfig } from './config';

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

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.useGlobalFilters(new HttpExceptionFilter());

  const { corsOrigin } = appConfig();
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-request-id'],
  });

  await app.listen(port, '0.0.0.0');
  console.log(`[boot] Listening on 0.0.0.0:${port}`);
}

bootstrap().catch((error) => {
  console.error('[boot] Fatal startup error:', error);
  process.exit(1);
});
