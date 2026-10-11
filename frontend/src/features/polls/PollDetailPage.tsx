import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PollDetailDTO } from '@community/shared';
import { VoteCard } from '../../components/VoteCard';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { useRouter } from '../../app/router';
import { ApiError } from '../../lib/apiClient';
import { useAppStore, type VoteSessionEntry } from '../../lib/store';
import { usePoll } from './hooks';
import { castVote } from './api';

const IDLE_ENTRY: VoteSessionEntry = { optionId: null, status: 'idle', error: null };

function isExpired(poll: PollDetailDTO): boolean {
  return poll.closesAt !== null && new Date(poll.closesAt).getTime() <= Date.now();
}

export function PollDetailPage({ pollId }: { pollId: number }) {
  const { navigate } = useRouter();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const pollQuery = usePoll(pollId);
  const voteEntry = useAppStore((state) => state.votes[pollId] ?? IDLE_ENTRY);
  const setVoteStatus = useAppStore((state) => state.setVoteStatus);

  const [alreadyVoted, setAlreadyVoted] = useState(false);

  const poll = pollQuery.data;
  const closed = poll !== undefined && (poll.status !== 'open' || isExpired(poll));
  const hasVoted = voteEntry.status === 'success';

  const submitVote = async (optionId: number) => {
    setAlreadyVoted(false);
    // Optimistic: mark selection as submitting immediately.
    setVoteStatus(pollId, { optionId, status: 'submitting', error: null });
    try {
      await castVote(pollId, optionId);
      setVoteStatus(pollId, { optionId, status: 'success', error: null });
      await queryClient.invalidateQueries({ queryKey: ['poll', pollId] });
    } catch (err) {
      // Rollback optimistic state.
      setVoteStatus(pollId, { optionId: null, status: 'error', error: null });
      if (err instanceof ApiError) {
        if (err.code === 'VOTE_DUPLICATE' || err.status === 409) {
          setAlreadyVoted(true);
        } else if (err.status === 429) {
          push({ tone: 'error', message: 'Too many requests, slow down' });
        } else {
          push({ tone: 'error', message: err.message || 'Vote failed. Please try again.' });
        }
      } else {
        push({ tone: 'error', message: 'Network error. Please try again.' });
      }
    }
  };

  if (pollQuery.isLoading) {
    return <Skeleton variant="card" count={1} />;
  }

  if (pollQuery.isError || !poll) {
    return (
      <EmptyState
        title="Poll not found"
        description="This poll does not exist or is not published yet."
        action={
          <Button variant="secondary" onClick={() => navigate('/')}>
            Back to polls
          </Button>
        }
      />
    );
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <Button variant="ghost" onClick={() => navigate('/')}>
        ← All polls
      </Button>
      <VoteCard
        poll={poll}
        selectedOptionId={voteEntry.optionId}
        hasVoted={hasVoted}
        onOptionSelect={(optionId) =>
          setVoteStatus(pollId, { optionId, status: 'idle', error: null })
        }
        onSubmitVote={(optionId) => {
          void submitVote(optionId);
        }}
        disabled={closed}
        expiryLabel={closed ? (isExpired(poll) ? 'Voting closed' : 'Not open') : undefined}
        onOpenResults={() => navigate(`/polls/${pollId}/results`)}
      />
      {hasVoted ? (
        <p data-testid="vote-success" className="text-body-lg text-voted" role="status">
          Thanks — your vote was counted.
        </p>
      ) : null}
      {alreadyVoted ? (
        <p
          data-testid="vote-duplicate"
          className="text-body-lg text-closed"
          role="alert"
        >
          You already voted in this poll.{' '}
          <a
            href={`/polls/${pollId}/results`}
            className="font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={(event) => {
              event.preventDefault();
              navigate(`/polls/${pollId}/results`);
            }}
          >
            View results
          </a>
        </p>
      ) : null}
    </section>
  );
}
