import { Module } from '@nestjs/common';
import { ParseModule } from './parse/parse.module';
import { CashController } from './cash.controller';
import { SimpleFinModule } from './simplefin/simplefin.module';
import { UsersModule } from './users/users.module';
import { VoiceModule } from './voice/voice.module';

@Module({
  imports: [SimpleFinModule, UsersModule, VoiceModule, ParseModule],
  controllers: [CashController],
})
export class CashModule {}
