import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SimpleFinConnection } from '../cash_calendar/entities/simplefin-connection.entity';
import { databaseHostHint, resolveDatabaseSsl } from './database.ssl';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.getOrThrow<string>('DATABASE_URL');
        const ssl = resolveDatabaseSsl(
          databaseUrl,
          config.get<string>('DATABASE_SSL'),
        );

        console.log('[db] TypeORM config', {
          host: databaseHostHint(databaseUrl),
          ssl: ssl === false ? 'disabled' : 'enabled',
          synchronize: config.get<string>('NODE_ENV') !== 'production',
        });

        return {
          type: 'postgres' as const,
          url: databaseUrl,
          entities: [SimpleFinConnection],
          synchronize: config.get<string>('NODE_ENV') !== 'production',
          ssl,
          retryAttempts: 3,
          retryDelay: 2000,
          extra: {
            connectionTimeoutMillis: 15_000,
          },
        };
      },
    }),
    TypeOrmModule.forFeature([SimpleFinConnection]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
