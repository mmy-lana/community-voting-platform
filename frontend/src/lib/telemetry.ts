/**
 * Global client telemetry (specs/04 §4).
 *
 * Captures `window.onerror`-style errors and unhandled promise rejections and
 * POSTs {route, errorName, requestId} to /api/v1/telemetry/client-error/.
 * Fire-and-forget, throttled client-side to at most one report per 5s.
 */

const TELEMETRY_URL = 'http://localhost:8102/api/v1/telemetry/client-error/';
const THROTTLE_MS = 5_000;

let lastSentAt = 0;
let installed = false;

/** Exported for tests; respects the 5s throttle. Returns true when sent. */
export function reportClientError(payload: {
  route: string;
  errorName: string;
  requestId?: string;
}): boolean {
  const now = Date.now();
  if (now - lastSentAt < THROTTLE_MS) return false;
  lastSentAt = now;

  // Fire-and-forget: never await, never surface failures.
  void fetch(TELEMETRY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      route: payload.route,
      errorName: payload.errorName,
      requestId: payload.requestId ?? '',
    }),
    keepalive: true,
  }).catch(() => {
    /* telemetry must never break the app */
  });
  return true;
}

function currentRoute(): string {
  return typeof window !== 'undefined' ? window.location.pathname : '/';
}

export function installTelemetry(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    reportClientError({
      route: currentRoute(),
      errorName: event.error instanceof Error ? event.error.name : 'Error',
      requestId: crypto.randomUUID(),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { name?: string } | null | undefined;
    reportClientError({
      route: currentRoute(),
      errorName: reason instanceof Error ? reason.name : 'UnhandledRejection',
      requestId: crypto.randomUUID(),
    });
  });
}
