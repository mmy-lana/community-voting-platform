import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuditLogDTO } from '@community/shared';
import { Badge, Button, EmptyState, Modal, Skeleton } from '../../components';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useToast } from '../../components/Toast';
import { listPolls } from '../polls/api';
import {
  StaffApiError,
  bulkSetPollStatus,
  deleteVote,
  exportVotesCsv,
  getModerationStats,
  listAuditLog,
  listVotes,
  setPollStatus,
  type StaffVote,
} from './api';

const MAX_BULK = 50;

function useStaffErrorHandler() {
  const { push } = useToast();
  return (err: unknown, fallback: string) => {
    if (err instanceof StaffApiError) {
      push({
        tone: 'error',
        message: err.status === 429 ? 'Too many requests — slow down and retry.' : err.message || fallback,
      });
    } else {
      push({ tone: 'error', message: fallback });
    }
  };
}

function StatsCards() {
  const statsQuery = useQuery({
    queryKey: ['moderation', 'stats'],
    queryFn: getModerationStats,
    staleTime: 15_000,
  });

  if (statsQuery.isLoading) return <Skeleton variant="card" />;
  if (statsQuery.isError || !statsQuery.data) return null;

  const entries: [string, number][] = [
    ['Polls', statsQuery.data.pollsTotal ?? 0],
    ['Open', statsQuery.data.pollsOpen ?? 0],
    ['Closed', statsQuery.data.pollsClosed ?? 0],
    ['Votes', statsQuery.data.votesTotal ?? 0],
    ['Votes 24h', statsQuery.data.votesLast24h ?? 0],
    ['Audit entries', statsQuery.data.auditEntries ?? 0],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {entries.map(([label, value]) => (
        <div
          key={label}
          data-testid="stats-card"
          className="rounded-[--radius-card] border border-border bg-surface p-4 text-center"
        >
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-body-sm text-slate-500">{label}</p>
        </div>
      ))}
    </div>
  );
}

function PollControls({ onError }: { onError: (err: unknown, fallback: string) => void }) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const pollsQuery = useQuery({ queryKey: ['polls', {}], queryFn: () => listPolls({}) });
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['polls'] });
    void queryClient.invalidateQueries({ queryKey: ['moderation'] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ pollId, status }: { pollId: number; status: 'open' | 'closed' }) =>
      setPollStatus(pollId, status),
    onSuccess: (_data, variables) => {
      push({ tone: 'success', message: `Poll #${variables.pollId} is now ${variables.status}.` });
      invalidate();
    },
    onError: (err) => onError(err, 'Status change failed.'),
  });

  const bulkMutation = useMutation({
    mutationFn: (pollIds: number[]) => bulkSetPollStatus(pollIds, 'closed', 'Bulk close via moderation console'),
    onSuccess: (result) => {
      push({ tone: 'success', message: `Bulk close updated ${result.updated} poll(s), skipped ${result.skipped.length}.` });
      setSelected(new Set());
      invalidate();
    },
    onError: (err) => onError(err, 'Bulk close failed.'),
  });

  if (pollsQuery.isLoading) return <Skeleton variant="bar-row" count={3} />;
  if (pollsQuery.isError || !pollsQuery.data) {
    return <p className="text-body text-slate-500">Poll list unavailable.</p>;
  }

  const polls = pollsQuery.data;
  const selectedIds = [...selected];

  const toggle = (pollId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pollId)) next.delete(pollId);
      else if (next.size < MAX_BULK) next.add(pollId);
      return next;
    });
  };

  return (
    <div className="rounded-[--radius-card] border border-border bg-surface p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-title font-semibold">Poll status controls</h3>
        <div className="flex items-center gap-3">
          <span className="text-body-sm text-slate-500">{selectedIds.length}/{MAX_BULK} selected</span>
          <Button
            variant="danger"
            size="sm"
            disabled={selectedIds.length === 0 || bulkMutation.isPending}
            loading={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate(selectedIds)}
          >
            Bulk close selected
          </Button>
        </div>
      </div>
      <ul className="divide-y divide-border" data-testid="poll-controls">
        {polls.map((poll) => (
          <li key={poll.id} className="flex flex-wrap items-center gap-3 py-2">
            <input
              type="checkbox"
              aria-label={`Select poll ${poll.id}`}
              checked={selected.has(poll.id)}
              onChange={() => toggle(poll.id)}
              className="h-11 w-11 cursor-pointer accent-[--color-accent]"
            />
            <span className="flex-1 truncate text-body font-medium">
              #{poll.id} {poll.title}
            </span>
            <Badge tone={poll.status}>{poll.status}</Badge>
            {poll.status !== 'closed' ? (
              <Button
                variant="secondary"
                size="sm"
                loading={statusMutation.isPending && statusMutation.variables?.pollId === poll.id}
                onClick={() => statusMutation.mutate({ pollId: poll.id, status: 'closed' })}
              >
                Close
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                loading={statusMutation.isPending && statusMutation.variables?.pollId === poll.id}
                onClick={() => statusMutation.mutate({ pollId: poll.id, status: 'open' })}
              >
                Reopen
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VoteList({ onError }: { onError: (err: unknown, fallback: string) => void }) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ poll: '', voterIp: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<StaffVote | null>(null);
  const [reason, setReason] = useState('');
  // Stable so the Modal's focus effect doesn't re-run on every keystroke.
  const closeDeleteModal = useCallback(() => setPendingDelete(null), []);

  const normalizedFilters = {
    poll: filters.poll ? Number(filters.poll) : undefined,
    voterIp: filters.voterIp || undefined,
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    to: filters.to ? new Date(filters.to).toISOString() : undefined,
  };

  const votesQuery = useQuery({
    queryKey: ['moderation', 'votes', normalizedFilters, page],
    queryFn: () => listVotes({ ...normalizedFilters, page, pageSize: 20 }),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ voteId, auditReason }: { voteId: number; auditReason: string }) =>
      deleteVote(voteId, auditReason),
    onSuccess: () => {
      push({ tone: 'success', message: 'Vote deleted.' });
      setPendingDelete(null);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['moderation'] });
    },
    onError: (err) => {
      onError(err, 'Vote deletion failed.');
      if (err instanceof StaffApiError && err.status !== 429) {
        setPendingDelete(null);
      }
    },
  });

  const downloadCsv = async () => {
    try {
      await exportVotesCsv(normalizedFilters);
    } catch (err) {
      onError(err, 'CSV export failed.');
    }
  };

  const pagination = votesQuery.data?.pagination;

  return (
    <div className="rounded-[--radius-card] border border-border bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-title font-semibold">Votes</h3>
        <Button variant="secondary" size="sm" onClick={() => void downloadCsv()}>
          Export CSV
        </Button>
      </div>

      <form
        className="grid gap-2 sm:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          void votesQuery.refetch();
        }}
      >
        <input
          aria-label="Filter by poll id"
          placeholder="Poll id"
          value={filters.poll}
          onChange={(e) => setFilters((f) => ({ ...f, poll: e.target.value }))}
          className="min-h-[44px] rounded-[--radius-control] border border-border px-3 py-2 text-body"
        />
        <input
          aria-label="Filter by voter IP hash substring"
          placeholder="Voter IP hash…"
          value={filters.voterIp}
          onChange={(e) => setFilters((f) => ({ ...f, voterIp: e.target.value }))}
          className="min-h-[44px] rounded-[--radius-control] border border-border px-3 py-2 text-body"
        />
        <input
          aria-label="Filter from date"
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="min-h-[44px] rounded-[--radius-control] border border-border px-3 py-2 text-body"
        />
        <input
          aria-label="Filter to date"
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="min-h-[44px] rounded-[--radius-control] border border-border px-3 py-2 text-body"
        />
        <div className="sm:col-span-4">
          <Button variant="primary" size="sm" onClick={() => { setPage(1); void votesQuery.refetch(); }}>
            Apply filters
          </Button>
        </div>
      </form>

      {votesQuery.isLoading ? (
        <Skeleton variant="text" count={4} />
      ) : votesQuery.isError || !votesQuery.data ? (
        <p className="text-body text-slate-500">Votes unavailable.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body" data-testid="votes-table">
              <thead>
                <tr className="border-b border-border text-body-sm text-slate-500">
                  <th scope="col" className="py-2 pr-4">ID</th>
                  <th scope="col" className="py-2 pr-4">Poll</th>
                  <th scope="col" className="py-2 pr-4">Option</th>
                  <th scope="col" className="py-2 pr-4">Voter IP (hash)</th>
                  <th scope="col" className="py-2 pr-4">Created</th>
                  <th scope="col" className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {votesQuery.data.results.map((vote) => (
                  <tr key={vote.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 tabular-nums">{vote.id}</td>
                    <td className="py-2 pr-4 tabular-nums">{vote.pollId}</td>
                    <td className="py-2 pr-4 tabular-nums">{vote.optionId}</td>
                    <td className="py-2 pr-4 font-mono text-body-sm">{vote.voterIp.slice(0, 12)}…</td>
                    <td className="py-2 pr-4 text-body-sm">{vote.createdAt.slice(0, 19).replace('T', ' ')}</td>
                    <td className="py-2">
                      <Button variant="danger" size="sm" onClick={() => { setPendingDelete(vote); setReason(''); }}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
                {votesQuery.data.results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500">No votes match the filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" disabled={(pagination?.page ?? 1) <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <span className="text-body-sm text-slate-500">
              Page {pagination?.page ?? 1} of {pagination?.totalPages ?? 1} · {pagination?.totalItems ?? 0} votes
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={(pagination?.page ?? 1) >= (pagination?.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}

      <Modal
        open={pendingDelete !== null}
        onClose={closeDeleteModal}
        title="Delete vote"
        role="alertdialog"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={closeDeleteModal}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={reason.trim().length === 0 || deleteMutation.isPending}
              loading={deleteMutation.isPending}
              onClick={() => pendingDelete && deleteMutation.mutate({ voteId: pendingDelete.id, auditReason: reason.trim() })}
            >
              Delete vote
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p>
            Delete vote <strong>#{pendingDelete?.id}</strong> on poll{' '}
            <strong>#{pendingDelete?.pollId}</strong>? An audit reason is required.
          </p>
          <label className="block text-body-sm font-medium text-ink" htmlFor="delete-reason">
            Audit reason
            <textarea
              id="delete-reason"
              data-testid="delete-reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-[--radius-control] border border-border px-3 py-2 text-body"
              placeholder="e.g. Verified ballot stuffing from duplicate IP"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}

function AuditLogTable() {
  const auditQuery = useQuery({
    queryKey: ['moderation', 'audit'],
    queryFn: () => listAuditLog(1),
  });

  if (auditQuery.isLoading) return <Skeleton variant="text" count={4} />;
  if (auditQuery.isError || !auditQuery.data) {
    return <p className="text-body text-slate-500">Audit log unavailable.</p>;
  }

  const rows: AuditLogDTO[] = auditQuery.data.results;
  return (
    <div className="rounded-[--radius-card] border border-border bg-surface p-5">
      <h3 className="text-title font-semibold">Audit log</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-body" data-testid="audit-table">
          <thead>
            <tr className="border-b border-border text-body-sm text-slate-500">
              <th scope="col" className="py-2 pr-4">ID</th>
              <th scope="col" className="py-2 pr-4">Actor</th>
              <th scope="col" className="py-2 pr-4">Action</th>
              <th scope="col" className="py-2 pr-4">Entity</th>
              <th scope="col" className="py-2 pr-4">Reason</th>
              <th scope="col" className="py-2">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.id} className="border-b border-border/60">
                <td className="py-2 pr-4 tabular-nums">{entry.id}</td>
                <td className="py-2 pr-4">{entry.actor}</td>
                <td className="py-2 pr-4 font-mono text-body-sm">{entry.action}</td>
                <td className="py-2 pr-4 text-body-sm">
                  {entry.entityType} #{entry.entityId}
                </td>
                <td className="py-2 pr-4 text-body-sm text-slate-600">{entry.reason ?? '—'}</td>
                <td className="py-2 text-body-sm">{entry.createdAt.slice(0, 19).replace('T', ' ')}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-500">No audit entries yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ModerationPage() {
  const handleError = useStaffErrorHandler();

  // Probe staff access with the cheapest staff endpoint; a 403 here means the
  // whole console is unavailable to this visitor.
  const accessQuery = useQuery({
    queryKey: ['moderation', 'access'],
    queryFn: getModerationStats,
    retry: false,
  });

  if (accessQuery.isLoading) {
    return (
      <section className="space-y-4" aria-busy="true">
        <h2 className="text-2xl font-bold">Staff Moderation Console</h2>
        <Skeleton variant="card" />
      </section>
    );
  }

  if (accessQuery.error instanceof StaffApiError && accessQuery.error.status === 403) {
    return (
      <EmptyState
        title="Staff required"
        description="This console is restricted to staff. Authenticate with a valid staff bearer token and reload."
      />
    );
  }

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Staff Moderation Console</h2>
      <ErrorBoundary onRetry={() => void accessQuery.refetch()}>
        <StatsCards />
      </ErrorBoundary>
      <ErrorBoundary onRetry={() => void accessQuery.refetch()}>
        <PollControls onError={handleError} />
      </ErrorBoundary>
      <ErrorBoundary onRetry={() => void accessQuery.refetch()}>
        <VoteList onError={handleError} />
      </ErrorBoundary>
      <ErrorBoundary onRetry={() => void accessQuery.refetch()}>
        <AuditLogTable />
      </ErrorBoundary>
    </section>
  );
}
