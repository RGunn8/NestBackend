import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';

@Injectable()
export class EdgeThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { res } = this.getRequestResponse(context);
    const retryAfter = Math.ceil(throttlerLimitDetail.timeToExpire / 1000);
    if (retryAfter > 0) {
      res.setHeader('Retry-After', retryAfter);
    }

    throw new HttpException(
      {
        error: 'Too many requests',
        code: 'rate_limit_exceeded',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
