import { Module } from '@nestjs/common';
import { ParseModule } from '../parse/parse.module';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  imports: [ParseModule],
  controllers: [VoiceController],
  providers: [VoiceService],
})
export class VoiceModule {}
