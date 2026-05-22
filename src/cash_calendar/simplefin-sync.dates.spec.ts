import {
  clampSyncDateRange,
  defaultSyncStartSec,
  SIMPLEFIN_MAX_SYNC_DAYS,
} from './simplefin-sync.dates';

describe('simplefin-sync.dates', () => {
  it('caps range to 89 days', () => {
    const end = 1_700_000_000;
    const start = end - 100 * 86400;
    const { startDateSec, endDateSec, capped } = clampSyncDateRange(
      start,
      end,
    );
    expect(capped).toBe(true);
    expect(endDateSec - startDateSec).toBeLessThanOrEqual(
      SIMPLEFIN_MAX_SYNC_DAYS * 86400,
    );
  });

  it('defaults first sync to at most 89 days', () => {
    const now = Math.floor(Date.now() / 1000);
    const start = defaultSyncStartSec(null, 90, 7);
    expect(now - start).toBeLessThanOrEqual(SIMPLEFIN_MAX_SYNC_DAYS * 86400 + 1);
  });
});
