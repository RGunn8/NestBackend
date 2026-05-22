import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { edgeError, newRequestId } from '../utils/edge-response';

@Catch()
export class EdgeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(EdgeExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? newRequestId();
    const t0 = (request as Request & { _edgeT0?: number })._edgeT0 ?? Date.now();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        if (typeof obj.error === 'string') {
          response.status(status).json(
            edgeError(obj.error, t0, requestId, {
              ...(typeof obj.code === 'string' ? { code: obj.code } : {}),
            }),
          );
          return;
        }
        if ('message' in obj) {
          const m = obj.message as string | string[] | undefined;
          message = Array.isArray(m) ? m.join('; ') : (m ?? message);
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception);
    }

    response.status(status).json(edgeError(message, t0, requestId));
  }
}
