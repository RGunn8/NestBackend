/** SimpleFIN allows at most 90 days per /accounts request (use 89 to avoid cap warnings). */
export const SIMPLEFIN_MAX_SYNC_DAYS = 89;

export function clampSyncDateRange(
  startDateSec: number,
  endDateSec: number,
  maxDays = SIMPLEFIN_MAX_SYNC_DAYS,
): { startDateSec: number; endDateSec: number; capped: boolean } {
  const maxWindowSec = maxDays * 86400;
  let start = Math.floor(startDateSec);
  let end = Math.floor(endDateSec);
  let capped = false;

  if (end <= start) {
    end = start + 86400;
    capped = true;
  }

  if (end - start > maxWindowSec) {
    start = end - maxWindowSec;
    capped = true;
  }

  return { startDateSec: start, endDateSec: end, capped };
}

export function defaultSyncStartSec(
  lastSyncAt: string | null,
  defaultSyncDays: number,
  syncOverlapDays: number,
): number {
  const now = Math.floor(Date.now() / 1000);
  const maxDays = Math.min(defaultSyncDays, SIMPLEFIN_MAX_SYNC_DAYS);

  if (!lastSyncAt) {
    return now - maxDays * 86400;
  }

  const last = Math.floor(new Date(lastSyncAt).getTime() / 1000);
  if (!Number.isFinite(last)) {
    return now - maxDays * 86400;
  }

  return last - syncOverlapDays * 86400;
}
