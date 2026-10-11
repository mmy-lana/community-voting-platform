import { useEffect, useMemo, useRef, useState } from 'react';
import { focusManager, useQuery } from '@tanstack/react-query';
import type { ResultDTO, TimeSeriesResponseDTO } from '@community/shared';
import { BarChart, Badge, Button, EmptyState, Skeleton } from '../../components';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ApiError } from '../../lib/apiClient';
import { useRouter } from '../../app/router';
import { getLiveResults, getTimeSeries, type Granularity } from './api';
import { adaptiveIntervalMs, backoffIntervalMs, resultSignature } from './interval';
import { zeroFillTimeSeries } from './timeseries';
import { Sparkline } from './Sparkline';

export function ResultsPage({ pollId }: { pollId: number }) {
  const { navigate } = useRouter();
  const [granularity, setGranularity] = useState<Granularity>('hourly');

  // Adaptive polling bookkeeping: steps 2s -> 5s -> 10s -> 30s while responses
  // stay unchanged; resets on change or window refocus; backs off on 429.
  const unchangedCountRef = useRef(0);
  const currentIntervalRef = useRef(2_000);

  const resultsQuery = useQuery<ResultDTO, Error>({
    queryKey: ['results', pollId],
    queryFn: () => getLiveResults(pollId),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const error = query.state.error;
      if (error instanceof ApiError && error.status === 429) {
        currentIntervalRef.current = backoffIntervalMs(currentIntervalRef.current);
        return currentIntervalRef.current;
      }
      currentIntervalRef.current = adaptiveIntervalMs(unchangedCountRef.current);
      return currentIntervalRef.current;
    },
  });

  // Window refocus resets the adaptive sequence back to the fastest step.
  useEffect(() => {
    const unsubscribe = focusManager.subscribe((focused) => {
      if (focused) {
        unchangedCountRef.current = 0;
        currentIntervalRef.current = adaptiveIntervalMs(0);
      }
    });
    return unsubscribe;
  }, []);

  // Track consecutive unchanged responses for the adaptive ladder. Only
  // genuinely new fetch results (new data identity) are considered.
  const signature = resultsQuery.data ? resultSignature(resultsQuery.data) : null;
  const prevSignatureRef = useRef<string | null>(null);
  const prevDataRef = useRef<ResultDTO | null>(null);
  if (resultsQuery.data && resultsQuery.data !== prevDataRef.current) {
    if (prevSignatureRef.current !== null && signature === prevSignatureRef.current) {
      unchangedCountRef.current += 1;
    } else {
      unchangedCountRef.current = 0;
    }
    prevSignatureRef.current = signature;
    prevDataRef.current = resultsQuery.data;
  }

  const results = resultsQuery.data;

  const timeSeriesQuery = useQuery<TimeSeriesResponseDTO, Error>({
    queryKey: ['results', 'timeseries', pollId, granularity],
    queryFn: () => getTimeSeries(pollId, { granularity }),
    staleTime: 30_000,
  });

  const filledPoints = useMemo(() => {
    const series = timeSeriesQuery.data;
    if (!series) return [];
    return zeroFillTimeSeries(series, granularity);
  }, [timeSeriesQuery.data, granularity]);

  if (resultsQuery.isLoading) {
    return (
      <section className="space-y-4" aria-busy="true" aria-label="Loading results">
        <div className="flex items-center gap-3">
          <Skeleton variant="text" />
          <Skeleton variant="text" count={2} />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="rounded-[--radius-card] border border-border bg-surface p-5">
            <Skeleton variant="bar-row" count={4} />
          </div>
          <div className="rounded-[--radius-card] border border-border bg-surface p-5">
            <Skeleton variant="card" />
          </div>
        </div>
      </section>
    );
  }

  if (resultsQuery.isError || !results) {
    const status = resultsQuery.error instanceof ApiError ? resultsQuery.error.status : null;
    return (
      <EmptyState
        title={status === 404 ? 'Poll not found' : 'Results unavailable'}
        description={
          resultsQuery.error?.message ?? 'Live tallies could not be loaded. Please retry.'
        }
        action={
          <button
            type="button"
            data-testid="results-retry"
            onClick={() => void resultsQuery.refetch()}
            className="inline-flex min-h-[44px] items-center rounded-[--radius-control] bg-accent px-4 text-body-lg font-medium text-white hover:bg-accent-strong"
          >
            Retry
          </button>
        }
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/')}>← All polls</Button>
        <Button variant="ghost" onClick={() => navigate(`/polls/${results.pollId}`)}>
          ← Poll detail
        </Button>
      </div>
      <nav aria-label="Breadcrumb" className="text-body-sm text-slate-500">
        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="inline-flex min-h-[44px] min-w-[44px] items-center p-2 hover:underline">Home</a>
        {' / '}
        <a href={`/polls/${results.pollId}`} onClick={(e) => { e.preventDefault(); navigate(`/polls/${results.pollId}`); }} className="inline-flex min-h-[44px] min-w-[44px] items-center p-2 hover:underline">Polls</a>
        {` / Poll #${results.pollId}`}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Results for Poll #{results.pollId}</h2>
          <Badge tone={results.status}>{results.status}</Badge>
        </div>
        <p className="text-body-sm text-slate-500">
          Live tallies refresh automatically (2s–30s adaptive).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Left pane: live bar chart, rendered in place on refetch. */}
        <ErrorBoundary
          title="Chart failed to render"
          onRetry={() => void resultsQuery.refetch()}
        >
          <div className="rounded-[--radius-card] border border-border bg-surface p-5 space-y-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-title font-semibold">Tallies</h3>
              <p className="text-body-sm tabular-nums text-slate-600" data-testid="total-votes">
                {results.totalVotes} votes
              </p>
            </div>
            <BarChart data={results.results} highlightOptionId={results.winner?.optionId ?? null} />
            {results.winner ? (
              <div
                data-testid="winner-callout"
                className="rounded-[--radius-control] bg-voted/10 px-4 py-3 text-body-lg font-medium text-voted"
              >
                Winner: {results.winner.label} (option #{results.winner.optionId})
              </div>
            ) : (
              <div
                data-testid="winner-callout"
                className="rounded-[--radius-control] bg-slate-100 px-4 py-3 text-body-lg text-slate-600"
              >
                {results.totalVotes === 0
                  ? 'No votes yet — winner undecided.'
                  : 'Tie — no single winner.'}
              </div>
            )}
          </div>
        </ErrorBoundary>

        {/* Right pane: metadata + time-series. */}
        <div className="space-y-6">
          <div className="rounded-[--radius-card] border border-border bg-surface p-5 space-y-2">
            <h3 className="text-title font-semibold">Poll summary</h3>
            <dl className="text-body text-slate-700">
              <div className="flex justify-between py-1">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-medium capitalize">{results.status}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-slate-500">Total votes</dt>
                <dd className="font-medium tabular-nums">{results.totalVotes}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-slate-500">Options</dt>
                <dd className="font-medium tabular-nums">{results.results.length}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[--radius-card] border border-border bg-surface p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-title font-semibold">Vote activity</h3>
              <div className="flex gap-1" role="group" aria-label="Time series granularity">
                {(['hourly', 'daily'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGranularity(g)}
                    aria-pressed={granularity === g}
                    className={`min-h-[44px] min-w-[44px] rounded-[--radius-control] px-3 text-body-sm font-medium ${
                      granularity === g ? 'bg-accent text-white' : 'bg-slate-100 text-ink'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            {timeSeriesQuery.isLoading ? (
              <Skeleton variant="card" />
            ) : timeSeriesQuery.isError ? (
              <p className="text-body-sm text-closed" data-testid="timeseries-error">
                Time series unavailable: {timeSeriesQuery.error.message}
              </p>
            ) : (
              <>
                <p className="text-body-sm text-slate-500">
                  {timeSeriesQuery.data?.windowFrom.slice(0, 16)} →{' '}
                  {timeSeriesQuery.data?.windowTo.slice(0, 16)} (UTC, sparse buckets zero-filled)
                </p>
                <ErrorBoundary
                  title="Series failed to render"
                  onRetry={() => void timeSeriesQuery.refetch()}
                >
                  <Sparkline points={filledPoints} label={`Votes per ${granularity} bucket`} />
                </ErrorBoundary>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
