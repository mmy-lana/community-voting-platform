import type { AuditLogDTO, PollDetailDTO } from '@community/shared';

/** Dev staff bearer token; override via VITE_STAFF_API_TOKEN at build time. */
export const STAFF_API_TOKEN = 'dev-staff-token';

const BASE_URL = 'http://localhost:8102/api/v1';

export interface StaffVote {
  id: number;
  pollId: number;
  optionId: number;
  voterIp: string;
  idempotencyKey: string | null;
  createdAt: string;
}

export interface PaginatedList<T> {
  results: T[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface BulkStatusResult {
  updated: number;
  skipped: { id: number; reason: string }[];
}

export class StaffApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'StaffApiError';
    this.status = status;
    this.code = code;
  }
}

async function staffRequest<T>(path: string, init: RequestInit = {}): Promise<{ data: T; meta: { pagination?: PaginatedList<unknown>['pagination'] } | null }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${STAFF_API_TOKEN}`,
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 204) return { data: undefined as T, meta: null };

  const payload = (await response.json().catch(() => null)) as
    | {
        success: boolean;
        data: T | null;
        error: { code: string; message: string } | null;
        meta: { pagination?: PaginatedList<unknown>['pagination'] } | null;
      }
    | null;

  if (!response.ok || !payload || payload.success === false) {
    throw new StaffApiError(
      response.status,
      payload?.error?.code ?? 'INTERNAL_ERROR',
      payload?.error?.message ?? `Request failed with status ${response.status}`,
    );
  }
  return { data: payload.data as T, meta: payload.meta ?? null };
}

function parseList<T>(data: unknown, meta: { pagination?: PaginatedList<T>['pagination'] } | null): PaginatedList<T> {
  if (Array.isArray(data)) {
    return {
      results: data,
      pagination:
        meta?.pagination ?? {
          page: 1,
          pageSize: data.length,
          totalItems: data.length,
          totalPages: 1,
        },
    };
  }
  const envelope = data as { results?: T[]; pagination?: PaginatedList<T>['pagination'] } | null;
  return {
    results: envelope?.results ?? [],
    pagination:
      envelope?.pagination ??
      meta?.pagination ?? { page: 1, pageSize: 0, totalItems: 0, totalPages: 0 },
  };
}

export async function setPollStatus(
  pollId: number,
  status: 'draft' | 'open' | 'closed',
  reason?: string,
): Promise<PollDetailDTO> {
  return (await staffRequest<PollDetailDTO>(`/moderation/polls/${pollId}/status/`, {
    method: 'POST',
    body: JSON.stringify({ status, reason }),
  })).data;
}

export async function bulkSetPollStatus(
  pollIds: number[],
  status: 'draft' | 'open' | 'closed',
  reason?: string,
): Promise<BulkStatusResult> {
  return (await staffRequest<BulkStatusResult>('/moderation/polls/bulk-status/', {
    method: 'POST',
    body: JSON.stringify({ pollIds, status, reason }),
  })).data;
}

export async function deleteVote(voteId: number, reason: string): Promise<void> {
  return (await staffRequest<void>(`/moderation/votes/${voteId}/`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  })).data;
}

export interface VoteListFilters {
  poll?: number;
  voterIp?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listVotes(filters: VoteListFilters = {}): Promise<PaginatedList<StaffVote>> {
  const params = new URLSearchParams();
  if (filters.poll) params.set('poll', String(filters.poll));
  if (filters.voterIp) params.set('voter_ip', filters.voterIp);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  const { data, meta } = await staffRequest<unknown>(`/moderation/votes/${qs ? `?${qs}` : ''}`);
  return parseList<StaffVote>(data, meta);
}

export async function listAuditLog(page = 1): Promise<PaginatedList<AuditLogDTO>> {
  const { data, meta } = await staffRequest<unknown>(`/moderation/audit/?page=${page}`);
  return parseList<AuditLogDTO>(data, meta);
}

export async function getModerationStats(): Promise<Record<string, number>> {
  return (await staffRequest<Record<string, number>>('/moderation/stats/')).data;
}

/** Downloads the votes CSV as a blob (Authorization header is required). */
export async function exportVotesCsv(filters: VoteListFilters = {}): Promise<void> {
  const params = new URLSearchParams();
  if (filters.poll) params.set('poll', String(filters.poll));
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const qs = params.toString();
  const response = await fetch(`${BASE_URL}/moderation/votes/export/${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${STAFF_API_TOKEN}` },
  });
  if (!response.ok) {
    throw new StaffApiError(response.status, 'EXPORT_FAILED', `Export failed with status ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'votes.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
