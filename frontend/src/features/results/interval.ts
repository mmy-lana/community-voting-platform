/**
 * Adaptive live-polling interval logic (specs/04 §1.2, §5).
 *
 * Sequence: 2s -> 5s -> 10s -> 30s, stepped by the number of *consecutive
 * unchanged* responses. Any changed response resets the step to 2s.
 *
 * 429 handling: the interval backs off exponentially from its current value
 * (doubling), capped at 60s per spec ("Throttled live polling").
 */

export const ADAPTIVE_INTERVALS_MS = [2_000, 5_000, 10_000, 30_000] as const;

export const MAX_POLL_INTERVAL_MS = 60_000;

/** Interval for the given count of consecutive unchanged responses. */
export function adaptiveIntervalMs(consecutiveUnchanged: number): number {
  const index = Math.min(Math.max(consecutiveUnchanged, 0), ADAPTIVE_INTERVALS_MS.length - 1);
  return ADAPTIVE_INTERVALS_MS[index];
}

/** Exponential 429 backoff from the current interval, capped at 60s. */
export function backoffIntervalMs(currentIntervalMs: number): number {
  const doubled = Math.max(currentIntervalMs, ADAPTIVE_INTERVALS_MS[0]) * 2;
  return Math.min(doubled, MAX_POLL_INTERVAL_MS);
}

/** Stable signature used to decide whether a ResultDTO changed. */
export function resultSignature(result: unknown): string {
  return JSON.stringify(result);
}
