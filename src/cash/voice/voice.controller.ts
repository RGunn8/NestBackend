import {
  Controller,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { EdgeExceptionFilter } from '../../common/filters/edge-exception.filter';
import { EdgeTimingInterceptor } from '../../common/interceptors/edge-timing.interceptor';
import { edgeError, edgeSuccess } from '../../common/utils/edge-response';
import { VoiceService } from './voice.service';

type EdgeRequest = Request & { _edgeT0?: number; _edgeRequestId?: string };

const AUDIO_LIMIT_BYTES = 15 * 1024 * 1024;

@SkipThrottle({ default: true })
@Controller('cash')
@UseFilters(EdgeExceptionFilter)
@UseInterceptors(EdgeTimingInterceptor)
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Post('voice-parse')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('audio', { limits: { fileSize: AUDIO_LIMIT_BYTES } }),
  )
  async voiceParse(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: EdgeRequest,
  ) {
    const t0 = req._edgeT0 ?? Date.now();
    const requestId = req._edgeRequestId ?? '';

    if (!file?.buffer?.length) {
      return edgeError(
        'Missing multipart field "audio"',
        t0,
        requestId,
      );
    }

    const out = await this.voice.parseAudio(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    return edgeSuccess(out, t0, requestId);
  }

  /** @deprecated Prefer POST /cash/voice-parse */
  @Post('voice/parse')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('audio', { limits: { fileSize: AUDIO_LIMIT_BYTES } }),
  )
  async voiceParseLegacy(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: EdgeRequest,
  ) {
    return this.voiceParse(file, req);
  }
}
