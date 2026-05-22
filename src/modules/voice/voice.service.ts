import { Injectable } from '@nestjs/common';
import { OpenAiService } from '../../parse/openai.service';
import { VoiceParseResponseDto } from './dto/voice-transaction.dto';

@Injectable()
export class VoiceService {
  constructor(private readonly openAi: OpenAiService) {}

  async parseAudio(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<VoiceParseResponseDto> {
    const transcript = await this.openAi.transcribeAudio(
      buffer,
      filename,
      mimeType,
    );

    if (!transcript) {
      return { transcript: '' };
    }

    const extracted = await this.openAi.parseVoiceTransaction(transcript);
    return { ...extracted, transcript };
  }
}
