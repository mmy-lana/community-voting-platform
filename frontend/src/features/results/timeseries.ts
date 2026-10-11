import type { TimeSeriesPointDTO, TimeSeriesResponseDTO } from '@community/shared';
import type { Granularity } from './api';

const HOURLY_MS = 3_600_000;
const DAILY_MS = 86_400_000;

/** Safety cap so a malformed (huge) window cannot freeze the UI. */
const MAX_BUCKETS = 24 * 31;

function stepMs(granularity: Granularity): number {
  return granularity === 'daily' ? DAILY_MS : HOURLY_MS;
}

/**
 * Zero-fills sparse buckets client-side between windowFrom and windowTo
 * (specs/04 §1.3). Existing points are matched by normalized bucket start.
 */
export function zeroFillTimeSeries(
  series: TimeSeriesResponseDTO,
  granularity: Granularity,
): TimeSeriesPointDTO[] {
  const from = Date.parse(series.windowFrom);
  const to = Date.parse(series.windowTo);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return [];

  const step = stepMs(granularity);
  const counts = new Map<number, number>();
  for (const point of series.points ?? []) {
    const time = Date.parse(point.bucketStart);
    if (!Number.isNaN(time)) counts.set(time, point.voteCount);
  }

  const filled: TimeSeriesPointDTO[] = [];
  // Floor the cursor to the interval boundary so generated bucket keys align
  // exactly with the server's date_trunc('hour'|'day') UTC bucket starts.
  const cursorDate = new Date(from);
  if (granularity === 'daily') {
    cursorDate.setUTCHours(0, 0, 0, 0);
  } else {
    cursorDate.setUTCMinutes(0, 0, 0);
  }
  let cursor = cursorDate.getTime();

  for (let i = 0; cursor <= to && i < MAX_BUCKETS; i += 1) {
    filled.push({
      bucketStart: new Date(cursor).toISOString(),
      voteCount: counts.get(cursor) ?? 0,
    });
    cursor += step;
  }
  return filled;
}
