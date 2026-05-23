import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { CashController } from './cash.controller';
import { SimpleFinOrchestratorService } from './simplefin/simplefin-orchestrator.service';
import { OpenAiService } from './parse/openai.service';

describe('CashController', () => {
  let cashController: CashController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [CashController],
      providers: [
        {
          provide: APP_GUARD,
          useValue: { canActivate: jest.fn(() => true) },
        },
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
          },
        },
      ],
    }).compile();

    cashController = app.get<CashController>(CashController);
  });

  it('should be defined', () => {
    expect(cashController).toBeDefined();
  });
});
