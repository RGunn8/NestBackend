import { randomUUID } from 'crypto';

export type TimingsMs = { total: number };

export function newRequestId(): string {
  return randomUUID();
}

export function edgeSuccess<T extends Record<string, unknown>>(
  body: T,
  t0: number,
  requestId: string,
): T & { requestId: string; timingsMs: TimingsMs } {
  return {
    ...body,
    requestId,
    timingsMs: { total: Date.now() - t0 },
  };
}

export function edgeError(
  error: string,
  t0: number,
  requestId: string,
  extra?: Record<string, unknown>,
) {
  return {
    error,
    requestId,
    timingsMs: { total: Date.now() - t0 },
    ...extra,
  };
}
