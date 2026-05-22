import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { newRequestId } from '../utils/edge-response';

@Injectable()
export class EdgeTimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    req._edgeT0 = Date.now();
    req._edgeRequestId =
      (req.headers['x-request-id'] as string | undefined) ?? newRequestId();
    return next.handle();
  }
}
