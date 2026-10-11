import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ApiError } from '../../../lib/apiClient';
import { useAppStore } from '../../../lib/store';
import { useVoteSession } from '../useVoteSession';

function duplicateError() {
  return new ApiError(409, {
    code: 'VOTE_DUPLICATE',
    message: 'Vote already recorded for this poll.',
    details: null,
  });
}

describe('useVoteSession', () => {
  beforeEach(() => {
    useAppStore.setState({ votes: {} });
  });

  it('hydrates a fresh idle entry per poll from the zustand store', () => {
    const { result } = renderHook(() => useVoteSession(7));
    expect(result.current.entry).toEqual({ optionId: null, status: 'idle', error: null });

    act(() => {
      result.current.select(42);
    });
    expect(result.current.entry).toEqual({ optionId: 42, status: 'idle', error: null });
    expect(useAppStore.getState().votes[7]).toEqual({ optionId: 42, status: 'idle', error: null });
    // A different poll id stays untouched.
    expect(useAppStore.getState().votes[8]).toBeUndefined();
  });

  it('transitions idle -> submitting -> success and invokes onSuccess', async () => {
    const { result } = renderHook(() => useVoteSession(1));
    const cast = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    act(() => {
      result.current.select(11);
    });
    await act(async () => {
      const pending = result.current.submit(11, cast, { onSuccess });
      expect(useAppStore.getState().votes[1].status).toBe('submitting');
      await pending;
    });

    expect(cast).toHaveBeenCalledWith(1, 11);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.entry).toEqual({ optionId: 11, status: 'success', error: null });
    });
  });

  it('rolls back to error on 409 VOTE_DUPLICATE and calls onDuplicate (not onError)', async () => {
    const { result } = renderHook(() => useVoteSession(2));
    const cast = vi.fn().mockRejectedValue(duplicateError());
    const onDuplicate = vi.fn();
    const onError = vi.fn();

    act(() => {
      result.current.select(12);
    });
    await act(async () => {
      await result.current.submit(12, cast, { onDuplicate, onError });
    });

    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    // Optimistic selection rolled back: no option kept, status 'error'.
    expect(result.current.entry).toEqual({ optionId: null, status: 'error', error: null });
  });

  it('rolls back and surfaces the message on other failures via onError', async () => {
    const { result } = renderHook(() => useVoteSession(3));
    const cast = vi.fn().mockRejectedValue(new ApiError(429, { code: 'THROTTLED', message: 'Slow down', details: null }));
    const onError = vi.fn();

    await act(async () => {
      await result.current.submit(13, cast, { onError });
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.entry).toEqual({
      optionId: null,
      status: 'error',
      error: 'Slow down',
    });
  });

  it('resetVote clears the entry entirely', () => {
    const { result } = renderHook(() => useVoteSession(5));
    act(() => {
      result.current.select(9);
    });
    expect(useAppStore.getState().votes[5]).toBeDefined();
    act(() => {
      result.current.resetVote(5);
    });
    expect(useAppStore.getState().votes[5]).toBeUndefined();
    expect(result.current.entry.status).toBe('idle');
  });
});
