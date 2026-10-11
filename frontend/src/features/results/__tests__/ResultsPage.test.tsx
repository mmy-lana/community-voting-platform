import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ResultDTO } from '@community/shared';
import { ResultsPage } from '../ResultsPage';
import { getLiveResults, getTimeSeries } from '../api';

vi.mock('../api', () => ({
  getResults: vi.fn(),
  getLiveResults: vi.fn(),
  getTimeSeries: vi.fn(),
}));

const mockGetLiveResults = vi.mocked(getLiveResults);
const mockGetTimeSeries = vi.mocked(getTimeSeries);

const baseResult: ResultDTO = {
  pollId: 1,
  status: 'open',
  totalVotes: 128,
  results: [
    { optionId: 11, label: 'Dark mode', voteCount: 58, percentage: 45 },
    { optionId: 12, label: 'Notifications', voteCount: 39, percentage: 30 },
    { optionId: 13, label: 'Mobile app', voteCount: 31, percentage: 25 },
  ],
  winner: { optionId: 11, label: 'Dark mode' },
};

const updatedResult: ResultDTO = {
  ...baseResult,
  totalVotes: 129,
  results: [
    { optionId: 11, label: 'Dark mode', voteCount: 58, percentage: 44.9 },
    { optionId: 12, label: 'Notifications', voteCount: 40, percentage: 31 },
    { optionId: 13, label: 'Mobile app', voteCount: 31, percentage: 24.1 },
  ],
};

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderPage(pollId = 1) {
  const client = makeClient();
  const utils = render(
    <QueryClientProvider client={client}>
      <ResultsPage pollId={pollId} />
    </QueryClientProvider>,
  );
  return { client, ...utils };
}

describe('ResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTimeSeries.mockResolvedValue({
      windowFrom: '2026-01-01T00:00:00Z',
      windowTo: '2026-01-01T02:00:00Z',
      points: [{ bucketStart: '2026-01-01T00:00:00Z', voteCount: 5 }],
    });
  });

  it('renders skeleton while loading', async () => {
    let resolve!: (v: ResultDTO) => void;
    mockGetLiveResults.mockReturnValue(new Promise<ResultDTO>((r) => (resolve = r)));
    renderPage();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    resolve(baseResult);
    await waitFor(() => expect(screen.getByTestId('bar-chart')).toBeInTheDocument());
  });

  it('renders ResultDTO with counts and winner callout', async () => {
    mockGetLiveResults.mockResolvedValue(baseResult);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('bar-chart')).toBeInTheDocument());
    expect(screen.getByTestId('total-votes')).toHaveTextContent('128 votes');
    expect(screen.getByTestId('winner-callout')).toHaveTextContent('Winner: Dark mode');
    // percentages and counts from ResultDTO
    expect(screen.getByText('45% (58)')).toBeInTheDocument();
  });

  it('updates BarChart rows in place on refetch (no remount)', async () => {
    let call = 0;
    mockGetLiveResults.mockImplementation(() => {
      call += 1;
      return call === 1 ? Promise.resolve(baseResult) : Promise.resolve(updatedResult);
    });
    const { client } = renderPage();

    await waitFor(() => expect(screen.getByTestId('bar-chart')).toBeInTheDocument());
    const rowBefore = screen.getAllByText('Notifications')[0];
    expect(screen.getByTestId('total-votes')).toHaveTextContent('128 votes');

    await client.refetchQueries({ queryKey: ['results', 1] });

    await waitFor(() => expect(screen.getByTestId('total-votes')).toHaveTextContent('129 votes'));
    const rowAfter = screen.getAllByText('Notifications')[0];
    // Same DOM node => BarChart rendered in place with stable keys, no remount.
    expect(rowAfter).toBe(rowBefore);
    expect(mockGetLiveResults.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('31% (40)')).toBeInTheDocument();
  });

  it('renders empty-ish poll without winner as tie callout', async () => {
    mockGetLiveResults.mockResolvedValue({
      ...baseResult,
      totalVotes: 0,
      results: [
        { optionId: 11, label: 'Dark mode', voteCount: 0, percentage: 0 },
        { optionId: 12, label: 'Notifications', voteCount: 0, percentage: 0 },
      ],
      winner: null,
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('winner-callout')).toBeInTheDocument());
    expect(screen.getByTestId('winner-callout')).toHaveTextContent('No votes yet');
  });

  it('renders error state with retry on 404', async () => {
    mockGetLiveResults.mockRejectedValue(new Error('Poll not found'));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('results-retry')).toBeInTheDocument());
    expect(screen.getByText('Results unavailable')).toBeInTheDocument();
  });

  it('renders zero-filled sparkline from timeseries', async () => {
    mockGetLiveResults.mockResolvedValue(baseResult);
    mockGetTimeSeries.mockResolvedValue({
      windowFrom: '2026-01-01T00:00:00Z',
      windowTo: '2026-01-01T01:00:00Z',
      points: [{ bucketStart: '2026-01-01T00:00:00Z', voteCount: 5 }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('sparkline')).toBeInTheDocument());
  });
});
