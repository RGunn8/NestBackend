import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SimpleFinConnection } from '../cash_calendar/entities/simplefin-connection.entity';

function databaseSsl(
  databaseUrl: string,
  databaseSslFlag: string | undefined,
): false | { rejectUnauthorized: boolean } {
  if (databaseSslFlag === 'false') return false;
  if (
    databaseUrl.includes('localhost') ||
    databaseUrl.includes('127.0.0.1')
  ) {
    return false;
  }
  return { rejectUnauthorized: false };
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.getOrThrow<string>('DATABASE_URL');
        return {
          type: 'postgres' as const,
          url: databaseUrl,
          entities: [SimpleFinConnection],
          synchronize: config.get<string>('NODE_ENV') !== 'production',
          ssl: databaseSsl(databaseUrl, config.get<string>('DATABASE_SSL')),
        };
      },
    }),
    TypeOrmModule.forFeature([SimpleFinConnection]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
