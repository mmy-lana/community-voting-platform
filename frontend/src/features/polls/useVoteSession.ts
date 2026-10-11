import { useCallback } from 'react';
import { useAppStore, type VoteSessionEntry } from '../../lib/store';
import { ApiError } from '../../lib/apiClient';

const IDLE_ENTRY: VoteSessionEntry = { optionId: null, status: 'idle', error: null };

function isDuplicateVoteError(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'VOTE_DUPLICATE' || err.status === 409);
}

export interface VoteSubmitCallbacks {
  /** Runs after the vote was accepted (e.g. TanStack cache invalidation). */
  onSuccess?: () => void | Promise<void>;
  /** Runs when the backend rejected with 409 VOTE_DUPLICATE. */
  onDuplicate?: () => void;
  /** Runs on any other failure (network, 429, 5xx…). */
  onError?: (err: unknown) => void;
}

/**
 * Hydrates the zustand voteSession slice for one poll and exposes the
 * optimistic vote flow: select -> submit ('submitting' -> 'success' | 'error').
 */
export function useVoteSession(pollId: number) {
  const entry = useAppStore((state) => state.votes[pollId] ?? IDLE_ENTRY);
  const setVoteStatus = useAppStore((state) => state.setVoteStatus);
  const resetVote = useAppStore((state) => state.resetVote);

  /** Optimistically mark an option as locally selected (status stays 'idle'). */
  const select = useCallback(
    (optionId: number) => {
      setVoteStatus(pollId, { optionId, status: 'idle', error: null });
    },
    [pollId, setVoteStatus],
  );

  /**
   * Cast the vote through `cast` with optimistic status transitions.
   * On failure the optimistic selection is rolled back to the 'error' state.
   */
  const submit = useCallback(
    async (
      optionId: number,
      cast: (pollId: number, optionId: number) => Promise<unknown>,
      callbacks: VoteSubmitCallbacks = {},
    ): Promise<void> => {
      setVoteStatus(pollId, { optionId, status: 'submitting', error: null });
      try {
        await cast(pollId, optionId);
        setVoteStatus(pollId, { optionId, status: 'success', error: null });
        await callbacks.onSuccess?.();
      } catch (err) {
        if (isDuplicateVoteError(err)) {
          setVoteStatus(pollId, { optionId: null, status: 'error', error: null });
          callbacks.onDuplicate?.();
        } else {
          setVoteStatus(pollId, {
            optionId: null,
            status: 'error',
            error: err instanceof Error ? err.message : null,
          });
          callbacks.onError?.(err);
        }
      }
    },
    [pollId, setVoteStatus],
  );

  return { entry, select, submit, resetVote } as const;
}
