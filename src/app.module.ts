import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { CashModule } from './cash/cash.module';
import { EdgeThrottlerGuard } from './common/guards/edge-throttler.guard';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: Number(config.get('THROTTLE_TTL_MS') ?? 60_000),
            limit: Number(config.get('THROTTLE_LIMIT') ?? 60),
          },
          {
            name: 'ai',
            ttl: Number(config.get('THROTTLE_AI_TTL_MS') ?? 60_000),
            limit: Number(config.get('THROTTLE_AI_LIMIT') ?? 10),
          },
        ],
      }),
    }),
    DatabaseModule,
    HealthModule,
    CashModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: EdgeThrottlerGuard,
    },
  ],
})
export class AppModule {}
