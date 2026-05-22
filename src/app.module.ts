import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { CashCalendarModule } from './cash_calendar/cash-calendar.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { ParseModule } from './parse/parse.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    CashCalendarModule,
    ParseModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
