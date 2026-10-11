# Results Feature — Retry Semantics

Live tallies (`GET /api/v1/polls/{id}/results/live/`) are polled with TanStack
Query using an **adaptive refetch interval** (see `interval.ts`):

## Adaptive interval

- Ladder: **2s → 5s → 10s → 30s** (`ADAPTIVE_INTERVALS_MS`), stepped by the
  number of *consecutive unchanged* `ResultDTO` responses (deep-JSON signature
  comparison, `resultSignature`).
- Any changed response resets the ladder to **2s**.
- **Window refocus** (focusManager event) also resets the ladder to 2s, so
  returning to the tab always shows the fastest polling rate.
- `refetchOnWindowFocus: true` triggers an immediate refetch on focus.

## 429 backoff

- When the last poll failed with `429`, the next interval doubles from the
  current value (`backoffIntervalMs`), **capped at 60s** per spec 04 §5
  ("Throttled live polling"). A successful refetch returns the ladder to the
  unchanged-based step.

## Error boundary retry

- The chart pane and the sparkline pane are each wrapped in an
  `<ErrorBoundary>` (`src/components/ErrorBoundary.tsx`). A render error shows
  a compact widget; its **Retry** button clears the boundary state and calls
  `query.refetch()`.
- Page-level load errors (404 / network) render an `EmptyState` with a Retry
  button that refetches the results query.

## Zero-filled time series

- `timeseries.ts` zero-fills sparse `date_trunc` buckets client-side between
  `windowFrom`/`windowTo` (hourly or daily), capped at 744 buckets (31 days × 24h),
  then renders with a dependency-free inline SVG `Sparkline`.
