import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

describe('VoiceController', () => {
  let controller: VoiceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VoiceController],
      providers: [
        {
          provide: APP_GUARD,
          useValue: { canActivate: jest.fn(() => true) },
        },
        {
          provide: VoiceService,
          useValue: {
            parseAudio: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(VoiceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
