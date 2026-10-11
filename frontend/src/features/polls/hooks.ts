import { useQuery } from '@tanstack/react-query';
import type { PollDetailDTO, PollDTO } from '@community/shared';
import { getPoll, listPolls, type PollListFilters } from './api';

export function usePolls(filters: PollListFilters = {}) {
  return useQuery<PollDTO[], Error>({
    queryKey: ['polls', filters],
    queryFn: () => listPolls(filters),
    staleTime: 5_000,
  });
}

export function usePoll(pollId: number | string | null) {
  return useQuery<PollDetailDTO, Error>({
    queryKey: ['poll', pollId],
    queryFn: () => getPoll(pollId as number | string),
    staleTime: 5_000,
    enabled: pollId !== null,
  });
}
