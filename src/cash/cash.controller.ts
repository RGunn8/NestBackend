import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { EdgeExceptionFilter } from '../common/filters/edge-exception.filter';
import { EdgeTimingInterceptor } from '../common/interceptors/edge-timing.interceptor';
import { edgeError, edgeSuccess } from '../common/utils/edge-response';
import { OpenAiService } from './parse/openai.service';
import {
  SimpleFinClaimDto,
  SimpleFinSyncDto,
  SimpleFinUserIdDto,
} from './simplefin/dto/simplefin.dto';
import { SimpleFinOrchestratorService } from './simplefin/simplefin-orchestrator.service';

type EdgeRequest = Request & { _edgeT0?: number; _edgeRequestId?: string };

@SkipThrottle({ ai: true })
@Controller('cash')
@UseFilters(EdgeExceptionFilter)
@UseInterceptors(EdgeTimingInterceptor)
export class CashController {
  constructor(
    private readonly simpleFin: SimpleFinOrchestratorService,
    private readonly openAi: OpenAiService,
  ) {}

  @Get('simplefin/status')
  async simpleFinStatus(
    @Query('userId') userId: string,
    @Req() req: EdgeRequest,
  ) {
    const t0 = req._edgeT0 ?? Date.now();
    const requestId = req._edgeRequestId ?? '';
    const id = userId?.trim() ?? '';
    if (!id) {
      return edgeError('Missing userId', t0, requestId);
    }
    const out = await this.simpleFin.status(id);
    return edgeSuccess(out, t0, requestId);
  }

  @Post('simplefin/claim')
  @HttpCode(200)
  async simpleFinClaim(
    @Body() body: SimpleFinClaimDto,
    @Req() req: EdgeRequest,
  ) {
    const t0 = req._edgeT0 ?? Date.now();
    const requestId = req._edgeRequestId ?? '';
    const userId = body.userId?.trim() ?? '';
    const token = body.token ?? '';
    if (!userId) return edgeError('Missing userId', t0, requestId);
    if (!token.trim()) return edgeError('Missing token', t0, requestId);
    const out = await this.simpleFin.claim(userId, token);
    return edgeSuccess(out, t0, requestId);
  }

  @Post('simplefin/sync')
  @HttpCode(200)
  @SkipThrottle({ default: true, ai: false })
  async simpleFinSync(@Body() body: SimpleFinSyncDto, @Req() req: EdgeRequest) {
    const t0 = req._edgeT0 ?? Date.now();
    const requestId = req._edgeRequestId ?? '';
    const userId = body.userId?.trim() ?? '';
    if (!userId) return edgeError('Missing userId', t0, requestId);

    const startDate =
      typeof body.startDate === 'number'
        ? body.startDate
        : typeof body.startDateSec === 'number'
          ? body.startDateSec
          : undefined;
    const out = await this.simpleFin.sync(userId, startDate);
    return edgeSuccess(out, t0, requestId);
  }

  @Post('simplefin/disconnect')
  @HttpCode(200)
  async simpleFinDisconnect(
    @Body() body: SimpleFinUserIdDto,
    @Req() req: EdgeRequest,
  ) {
    const t0 = req._edgeT0 ?? Date.now();
    const requestId = req._edgeRequestId ?? '';
    const userId = body.userId?.trim() ?? '';
    if (!userId) return edgeError('Missing userId', t0, requestId);
    const out = await this.simpleFin.disconnect(userId);
    return edgeSuccess(out, t0, requestId);
  }

  @Post('text/parse')
  @HttpCode(200)
  @SkipThrottle({ default: true, ai: false })
  async parseText(@Body() body: { text?: string }, @Req() req: EdgeRequest) {
    const t0 = req._edgeT0 ?? Date.now();
    const requestId = req._edgeRequestId ?? '';
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) return edgeError('Missing text', t0, requestId);

    const transactions = await this.openAi.parseTransactionsFromText(text);
    return edgeSuccess({ transactions }, t0, requestId);
  }

  @Post('image/parse-transactions')
  @HttpCode(200)
  @SkipThrottle({ default: true, ai: false })
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  async parseImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: EdgeRequest,
  ) {
    const t0 = req._edgeT0 ?? Date.now();
    const requestId = req._edgeRequestId ?? '';
    if (!file?.buffer?.length) {
      return edgeError('Missing multipart field "image"', t0, requestId);
    }

    const transactions = await this.openAi.parseTransactionsFromImage(
      file.buffer,
      file.mimetype,
    );
    return edgeSuccess({ transactions }, t0, requestId);
  }
}
