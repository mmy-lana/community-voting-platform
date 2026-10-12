import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PollDetailDTO } from '@community/shared';
import { VoteCard } from '../../components/VoteCard';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { useRouter } from '../../app/router';
import { useVoteSession } from './useVoteSession';
import { usePoll } from './hooks';
import { castVote } from './api';
import { ApiError } from '../../lib/apiClient';

function isExpired(poll: PollDetailDTO): boolean {
  return poll.closesAt !== null && new Date(poll.closesAt).getTime() <= Date.now();
}

function isNotStarted(poll: PollDetailDTO): boolean {
  return poll.opensAt !== null && new Date(poll.opensAt).getTime() > Date.now();
}

export function PollDetailPage({ pollId }: { pollId: number }) {
  const { navigate } = useRouter();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const pollQuery = usePoll(pollId);
  const { entry: voteEntry, select, submit } = useVoteSession(pollId);

  const [alreadyVoted, setAlreadyVoted] = useState(false);

  // Duplicate-warning banner is component-local state; never leak across polls.
  useEffect(() => {
    setAlreadyVoted(false);
  }, [pollId]);

  const poll = pollQuery.data;
  const closed =
    poll !== undefined && (poll.status !== 'open' || isExpired(poll) || isNotStarted(poll));
  const hasVoted =
    voteEntry.status === 'success' || Boolean(poll?.userVotedOptionId) || alreadyVoted;
  const activeOptionId = voteEntry.optionId ?? poll?.userVotedOptionId ?? null;

  const submitVote = async (optionId: number) => {
    setAlreadyVoted(false);
    await submit(optionId, castVote, {
      onSuccess: async () => {
        // Refresh the poll detail, the list aggregates and the live tallies.
        await queryClient.invalidateQueries({ queryKey: ['poll', pollId] });
        void queryClient.invalidateQueries({ queryKey: ['results', pollId] });
        void queryClient.invalidateQueries({ queryKey: ['polls'] });
      },
      onDuplicate: () => setAlreadyVoted(true),
      onError: (err) => {
        if (err instanceof ApiError) {
          if (err.status === 429) {
            push({ tone: 'error', message: 'Too many requests, slow down' });
          } else {
            push({ tone: 'error', message: err.message || 'Vote failed. Please try again.' });
          }
        } else {
          push({ tone: 'error', message: 'Network error. Please try again.' });
        }
      },
    });
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
        selectedOptionId={activeOptionId}
        hasVoted={hasVoted}
        onOptionSelect={select}
        onSubmitVote={(optionId) => {
          void submitVote(optionId);
        }}
        disabled={closed}
        expiryLabel={
          closed
            ? isNotStarted(poll)
              ? 'Not open yet'
              : isExpired(poll)
                ? 'Voting closed'
                : 'Not open'
            : undefined
        }
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
