import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { buildTypeOrmConfig } from './database.config';
import { SimpleFinConnection } from '../cash/simplefin/entities/simplefin-connection.entity';

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
      useFactory: (config: ConfigService): DataSourceOptions =>
        buildTypeOrmConfig(
          config.getOrThrow<string>('DATABASE_URL'),
          config.get<string>('DATABASE_SSL'),
          config.get<string>('NODE_ENV'),
        ),
      dataSourceFactory: async (options?: DataSourceOptions) => {
        if (!options) {
          throw new Error('Missing TypeORM options');
        }

        console.log('[db] Initializing connection...');
        try {
          const dataSource = await withTimeout(
            new DataSource(options).initialize(),
            15_000,
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
