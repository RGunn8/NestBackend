import { HttpException, HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CashController } from '../src/cash/cash.controller';
import { SimpleFinOrchestratorService } from '../src/cash/simplefin/simplefin-orchestrator.service';
import { VoiceController } from '../src/cash/voice/voice.controller';
import { VoiceService } from '../src/cash/voice/voice.service';
import { EdgeExceptionFilter } from '../src/common/filters/edge-exception.filter';
import { OpenAiService } from '../src/cash/parse/openai.service';
import { ParseModule } from '../src/cash/parse/parse.module';

describe('Cash API (e2e)', () => {
  let app: INestApplication<App>;

  const mockOpenAi = {
    parseTransactionsFromText: jest.fn().mockResolvedValue([
      { description: 'Coffee', amount: -4.5 },
    ]),
    parseTransactionsFromImage: jest.fn().mockResolvedValue([
      { description: 'Groceries', amount: -32.1, date: '2026-05-01' },
    ]),
    transcribeAudio: jest.fn().mockResolvedValue('spent twelve dollars at cafe'),
    parseVoiceTransaction: jest.fn().mockResolvedValue({
      description: 'cafe',
      amount: 12,
      type: 'expense',
    }),
  };

  const mockSimpleFin = {
    status: jest.fn().mockResolvedValue({
      connected: false,
      createdAt: null,
      lastSyncAt: null,
      lastSyncError: null,
    }),
    claim: jest.fn().mockResolvedValue({ ok: true, connected: true }),
    sync: jest.fn().mockRejectedValue({
      getStatus: () => 400,
      getResponse: () => ({ error: 'Not connected', code: 'not_connected' }),
    }),
    disconnect: jest.fn().mockResolvedValue({ ok: true, connected: false }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ParseModule],
      controllers: [CashController, VoiceController],
      providers: [
        VoiceService,
        {
          provide: SimpleFinOrchestratorService,
          useValue: mockSimpleFin,
        },
      ],
    })
      .overrideProvider(OpenAiService)
      .useValue(mockOpenAi)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new EdgeExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /cash/text/parse returns transactions', async () => {
    const res = await request(app.getHttpServer())
      .post('/cash/text/parse')
      .send({ text: 'coffee -4.50' })
      .expect(200);

    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.requestId).toBeDefined();
    expect(res.body.timingsMs.total).toBeGreaterThanOrEqual(0);
  });

  it('POST /cash/text/parse missing text returns error shape', async () => {
    const res = await request(app.getHttpServer())
      .post('/cash/text/parse')
      .send({})
      .expect(200);

    expect(res.body.error).toBe('Missing text');
    expect(res.body.requestId).toBeDefined();
  });

  it('GET /cash/simplefin/status returns connection status', async () => {
    const res = await request(app.getHttpServer())
      .get('/cash/simplefin/status')
      .query({ userId: 'user-1' })
      .expect(200);

    expect(res.body.connected).toBe(false);
    expect(res.body.requestId).toBeDefined();
  });

  it('POST /cash/simplefin/sync not connected returns edge error with code', async () => {
    mockSimpleFin.sync.mockRejectedValueOnce(
      new HttpException(
        { error: 'Not connected', code: 'not_connected' },
        HttpStatus.BAD_REQUEST,
      ),
    );

    const res = await request(app.getHttpServer())
      .post('/cash/simplefin/sync')
      .send({ userId: 'user-1' })
      .expect(400);

    expect(res.body.error).toBe('Not connected');
    expect(res.body.code).toBe('not_connected');
    expect(res.body.requestId).toBeDefined();
  });

  it('POST /cash/voice/parse returns voice extraction', async () => {
    const res = await request(app.getHttpServer())
      .post('/cash/voice/parse')
      .attach('audio', Buffer.from('fake-audio'), {
        filename: 'test.m4a',
        contentType: 'audio/m4a',
      })
      .expect(200);

    expect(res.body.type).toBe('expense');
    expect(res.body.transcript).toContain('cafe');
    expect(res.body.requestId).toBeDefined();
  });
});
