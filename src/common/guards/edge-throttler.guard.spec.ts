import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { EdgeThrottlerGuard } from './edge-throttler.guard';

describe('EdgeThrottlerGuard', () => {
  const options: ThrottlerModuleOptions = {
    throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
  };

  const storage: ThrottlerStorage = {
    increment: jest.fn(),
    getRecord: jest.fn(),
  };

  const guard = new EdgeThrottlerGuard(options, storage, new Reflector());

  it('throws edge-compatible 429 response', async () => {
    const setHeader = jest.fn();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '127.0.0.1',
          headers: {},
        }),
        getResponse: () => ({
          setHeader,
          header: jest.fn(),
        }),
      }),
      getClass: () => ({ name: 'TestController' }),
      getHandler: () => ({ name: 'test' }),
    } as unknown as ExecutionContext;

    await expect(
      guard['throwThrottlingException'](context, {
        limit: 10,
        ttl: 60_000,
        key: 'test-key',
        tracker: '127.0.0.1',
        totalHits: 11,
        timeToExpire: 45_000,
        isBlocked: true,
        timeToBlockExpire: 45,
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      response: {
        error: 'Too many requests',
        code: 'rate_limit_exceeded',
      },
    });

    expect(setHeader).toHaveBeenCalledWith('Retry-After', 45);
  });

  it('throws HttpException instance', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ ip: '127.0.0.1', headers: {} }),
        getResponse: () => ({ setHeader: jest.fn(), header: jest.fn() }),
      }),
      getClass: () => ({ name: 'TestController' }),
      getHandler: () => ({ name: 'test' }),
    } as unknown as ExecutionContext;

    try {
      await guard['throwThrottlingException'](context, {
        limit: 10,
        ttl: 60_000,
        key: 'test-key',
        tracker: '127.0.0.1',
        totalHits: 11,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: 0,
      });
      fail('Expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
    }
  });
});
