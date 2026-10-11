import { v4 as uuidv4 } from 'uuid';
import type {
  ApiError as ApiErrorPayload,
  ApiListResponseEnvelope,
  ApiResponseEnvelope,
} from '@community/shared';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, string[]> | null;

  constructor(status: number, error: ApiErrorPayload) {
    super(error.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = error.code;
    this.details = error.details ?? null;
  }
}

type Envelope<T> = ApiResponseEnvelope<T> | ApiListResponseEnvelope<T>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rawRequest<T>(
  path: string,
  options: RequestOptions,
): Promise<{ envelope: Envelope<T>; status: number }> {
  const requestId = uuidv4();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const externalSignal = options.signal;
  const onAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        ...(options.headers ?? {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as Envelope<T> | null;

    if (!response.ok || !payload || payload.success === false) {
      const error: ApiErrorPayload =
        payload?.error ??
        {
          code: 'INTERNAL_ERROR',
          message: `Request failed with status ${response.status}`,
          details: null,
        };
      throw new ApiError(response.status, error);
    }

    return { envelope: payload, status: response.status };
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', onAbort);
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isIdempotent = (options.method ?? 'GET') === 'GET';
  let lastError: unknown;

  for (let attempt = 0; attempt <= (isIdempotent ? 2 : 0); attempt += 1) {
    try {
      const { envelope } = await rawRequest<T>(path, options);
      return envelope.data as T;
    } catch (err) {
      lastError = err;
      // Only transient network failures are retried; HTTP errors are final.
      if (err instanceof ApiError) throw err;
      if (attempt < 2) await sleep(300 * 2 ** attempt);
    }
  }
  throw lastError;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'POST', body, headers }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
