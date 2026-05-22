import { edgeError, edgeSuccess } from './edge-response';

describe('edge-response helpers', () => {
  it('edgeSuccess adds requestId and timingsMs', () => {
    const t0 = Date.now() - 10;
    const out = edgeSuccess({ ok: true }, t0, 'req-1');
    expect(out.ok).toBe(true);
    expect(out.requestId).toBe('req-1');
    expect(out.timingsMs.total).toBeGreaterThanOrEqual(0);
  });

  it('edgeError returns error shape', () => {
    const out = edgeError('Missing userId', Date.now(), 'req-2');
    expect(out.error).toBe('Missing userId');
    expect(out.requestId).toBe('req-2');
    expect(out.timingsMs).toBeDefined();
  });
});
