import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { SimpleFinConnection } from '../cash_calendar/entities/simplefin-connection.entity';
import { databaseHostHint, resolveDatabaseSsl } from './database.ssl';

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      );
    }),
  ]);
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): DataSourceOptions => {
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
          type: 'postgres',
          url: databaseUrl,
          entities: [SimpleFinConnection],
          synchronize: config.get<string>('NODE_ENV') !== 'production',
          ssl,
          extra: {
            connectionTimeoutMillis: 15_000,
          },
        };
      },
      dataSourceFactory: async (options?: DataSourceOptions) => {
        if (!options) {
          throw new Error('Missing TypeORM options');
        }

        console.log('[db] Initializing connection...');
        try {
          const dataSource = await withTimeout(
            new DataSource(options).initialize(),
            20_000,
            'Database connection',
          );
          console.log('[db] Connected successfully');
          return dataSource;
        } catch (error) {
          console.error('[db] Connection failed:', error);
          throw error;
        }
      },
    }),
    TypeOrmModule.forFeature([SimpleFinConnection]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
