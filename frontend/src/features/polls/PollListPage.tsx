import { useState } from 'react';
import type { PollDTO } from '@community/shared';
import { useRouter } from '../../app/router';
import { Badge, Button, EmptyState, Skeleton } from '../../components';
import { usePolls } from './hooks';
import type { PollStatusFilter } from './api';

const FILTERS: Array<{ value: PollStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

function statusTone(status: PollDTO['status']) {
  if (status === 'open') return 'open' as const;
  if (status === 'closed') return 'closed' as const;
  return 'draft' as const;
}

function PollCard({ poll, onOpen }: { poll: PollDTO; onOpen: (id: number) => void }) {
  return (
    <article
      data-testid="poll-card"
      className="flex flex-col gap-3 rounded-[--radius-card] border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-title font-semibold text-ink">{poll.title}</h3>
        <Badge tone={statusTone(poll.status)}>{poll.status}</Badge>
      </div>
      {poll.description ? (
        <p className="line-clamp-2 text-body-lg text-slate-600">{poll.description}</p>
      ) : null}
      <dl className="mt-auto flex flex-wrap gap-x-6 gap-y-1 text-body-sm text-slate-600">
        <div className="flex gap-1">
          <dt className="font-semibold text-ink">Votes:</dt>
          <dd>{poll.totalVotes}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-semibold text-ink">Leading:</dt>
          <dd>{poll.leadOptionLabel ?? '—'}</dd>
        </div>
      </dl>
      <Button variant="secondary" onClick={() => onOpen(poll.id)}>
        View poll
      </Button>
    </article>
  );
}

export function PollListPage() {
  const initial = (new URLSearchParams(window.location.search).get('status') ??
    'all') as PollStatusFilter;
  const [statusFilter, setStatusFilter] = useState<PollStatusFilter>(initial);
  const pollsQuery = usePolls({ status: statusFilter });
  const { navigate } = useRouter();

  const applyFilter = (next: PollStatusFilter) => {
    setStatusFilter(next);
    const url = next === 'all' ? '/' : `/?status=${next}`;
    window.history.replaceState(null, '', url);
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Community Polls</h2>
        <p className="text-gray-600">Select a poll to cast your vote or view current tallies.</p>
      </div>

      <div role="tablist" aria-label="Filter polls by status" className="flex gap-2">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={statusFilter === value}
            data-testid={`filter-${value}`}
            onClick={() => applyFilter(value)}
            className={[
              'min-h-[44px] rounded-[--radius-control] border px-4 text-body-lg transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              statusFilter === value
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-white text-ink hover:bg-slate-100',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {pollsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton variant="card" count={6} />
        </div>
      ) : pollsQuery.isError ? (
        <EmptyState
          title="Could not load polls"
          description={pollsQuery.error?.message ?? 'Please try again later.'}
        />
      ) : (pollsQuery.data ?? []).length === 0 ? (
        <EmptyState
          title="No polls here yet"
          description={
            statusFilter === 'all'
              ? 'There are no published polls at the moment. Check back soon.'
              : `There are no ${statusFilter} polls right now.`
          }
        />
      ) : (
        <div
          data-testid="poll-grid"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-[1200px]"
        >
          {pollsQuery.data!.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              onOpen={(id) => navigate(`/polls/${id}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
