import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { SimpleFinOrchestratorService } from './cash_calendar/simplefin-orchestrator.service';
import { OpenAiService } from './parse/openai.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: SimpleFinOrchestratorService,
          useValue: {
            status: jest.fn(),
            claim: jest.fn(),
            sync: jest.fn(),
            disconnect: jest.fn(),
          },
        },
        {
          provide: OpenAiService,
          useValue: {
            parseTransactionsFromText: jest.fn(),
            parseTransactionsFromImage: jest.fn(),
            transcribeAudio: jest.fn(),
            parseVoiceTranscript: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });
});
