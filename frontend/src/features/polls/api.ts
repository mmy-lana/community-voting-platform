import { v4 as uuidv4 } from 'uuid';
import type { PollDTO, PollDetailDTO, VoteDTO } from '@community/shared';
import { apiClient } from '../../lib/apiClient';

export type PollStatusFilter = 'all' | 'open' | 'closed';

export interface PollListFilters {
  status?: PollStatusFilter;
  search?: string;
}

export async function listPolls(filters: PollListFilters = {}): Promise<PollDTO[]> {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  const qs = params.toString();
  return apiClient.get<PollDTO[]>(`/polls/${qs ? `?${qs}` : ''}`);
}

export async function getPoll(pollId: number | string): Promise<PollDetailDTO> {
  return apiClient.get<PollDetailDTO>(`/polls/${pollId}/`);
}

export async function castVote(pollId: number | string, optionId: number): Promise<VoteDTO> {
  return apiClient.post<VoteDTO>(
    `/polls/${pollId}/votes/`,
    { optionId },
    { 'Idempotency-Key': uuidv4() },
  );
}
