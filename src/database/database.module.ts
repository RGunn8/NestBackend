import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SimpleFinConnection } from '../cash_calendar/entities/simplefin-connection.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [SimpleFinConnection],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        ssl:
          config.get<string>('DATABASE_SSL') === 'false'
            ? false
            : { rejectUnauthorized: false },
      }),
    }),
    TypeOrmModule.forFeature([SimpleFinConnection]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
