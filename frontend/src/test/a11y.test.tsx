import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axe from 'axe-core';
import type { PollDTO, ResultDTO, TimeSeriesResponseDTO } from '@community/shared';
import { RouterProvider } from '../app/router';
import { ToastProvider } from '../components/Toast';
import { useAppStore } from '../lib/store';
import { NotFoundPage } from '../app/NotFoundPage';
import { PollListPage } from '../features/polls/PollListPage';
import { PollDetailPage } from '../features/polls/PollDetailPage';
import { ResultsPage } from '../features/results/ResultsPage';
import { ModerationPage } from '../features/moderation/ModerationPage';
import { ComponentShowcasePage } from '../features/components/ComponentShowcasePage';
import { listPolls } from '../features/polls/api';
import { getLiveResults, getTimeSeries } from '../features/results/api';
import {
  StaffApiError,
  getModerationStats,
  listAuditLog,
  listVotes,
} from '../features/moderation/api';
import { samplePoll } from './fixtures';

vi.mock('../features/polls/api', () => ({
  listPolls: vi.fn(),
  getPoll: vi.fn(),
  castVote: vi.fn(),
}));

vi.mock('../features/results/api', () => ({
  getLiveResults: vi.fn(),
  getTimeSeries: vi.fn(),
}));

vi.mock('../features/moderation/api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getModerationStats: vi.fn(),
  listAuditLog: vi.fn(),
  listVotes: vi.fn(),
  setPollStatus: vi.fn(),
  bulkSetPollStatus: vi.fn(),
  deleteVote: vi.fn(),
  exportVotesCsv: vi.fn(),
}));

const mockedListPolls = vi.mocked(listPolls);
const mockedGetLiveResults = vi.mocked(getLiveResults);
const mockedGetTimeSeries = vi.mocked(getTimeSeries);
const mockedGetModerationStats = vi.mocked(getModerationStats);
const mockedListVotes = vi.mocked(listVotes);
const mockedListAuditLog = vi.mocked(listAuditLog);

const pollListItem: PollDTO = {
  id: 1,
  title: 'Favorite community feature?',
  description: 'Which feature should we build next sprint?',
  status: 'open',
  isAnonymous: true,
  allowRevote: false,
  opensAt: null,
  closesAt: null,
  totalVotes: 128,
  leadOptionLabel: 'Dark mode',
};

const sampleResults: ResultDTO = {
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

const sampleTimeSeries: TimeSeriesResponseDTO = {
  windowFrom: '2026-02-01T00:00:00Z',
  windowTo: '2026-02-02T00:00:00Z',
  points: [
    { bucketStart: '2026-02-01T10:00:00Z', voteCount: 4 },
    { bucketStart: '2026-02-01T12:00:00Z', voteCount: 7 },
  ],
};

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

async function expectNoSeriousViolations(container: HTMLElement, label: string) {
  const results = await axe.run(container, {
    resultTypes: ['violations'],
  });
  const serious = results.violations.filter((v) => v.impact !== 'minor');
  expect(
    serious.map((v) => `${v.id}(${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    `${label} has non-minor axe violations`,
  ).toEqual([]);
  return results.violations;
}

function withProviders(ui: ReactElement) {
  const queryClient = makeClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider>{ui}</RouterProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('a11y (axe) — route-level accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/');
    mockedListPolls.mockResolvedValue([pollListItem, { ...pollListItem, id: 2, status: 'closed' as const }]);
    mockedGetLiveResults.mockResolvedValue(sampleResults);
    mockedGetTimeSeries.mockResolvedValue(sampleTimeSeries);
    mockedGetModerationStats.mockResolvedValue({
      pollsTotal: 2,
      pollsOpen: 1,
      pollsClosed: 1,
      votesTotal: 128,
      votesLast24h: 12,
      auditEntries: 3,
    });
    mockedListVotes.mockResolvedValue({
      results: [
        {
          id: 31,
          pollId: 1,
          optionId: 11,
          voterIp: 'a1b2c3d4e5f6a7b8',
          idempotencyKey: 'k-1',
          createdAt: '2026-02-01T10:00:00Z',
        },
      ],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    });
    mockedListAuditLog.mockResolvedValue({
      results: [
        {
          id: 1,
          actor: 'admin',
          action: 'poll.close',
          entityType: 'poll',
          entityId: 2,
          reason: 'Spam',
          createdAt: '2026-02-01T10:00:00Z',
        },
      ],
      pagination: { page: 1, pageSize: 0, totalItems: 1, totalPages: 1 },
    });
  });

  it('PollListPage has no critical/serious/moderate violations', async () => {
    const { container } = withProviders(<PollListPage />);
    await expectNoSeriousViolations(container, 'PollListPage');
  });

  it('PollDetailPage has no critical/serious/moderate violations', async () => {
    const { getPoll } = await import('../features/polls/api');
    vi.mocked(getPoll).mockResolvedValue(samplePoll);
    const { container } = withProviders(<PollDetailPage pollId={1} />);
    await expectNoSeriousViolations(container, 'PollDetailPage');
  });

  it('ResultsPage has no critical/serious/moderate violations', async () => {
    const { container } = withProviders(<ResultsPage pollId={1} />);
    await expectNoSeriousViolations(container, 'ResultsPage');
  });

  it('ModerationPage has no critical/serious/moderate violations', async () => {
    useAppStore.setState({ staffToken: 'test-staff-token', staffSessionMode: false });
    const { container } = withProviders(<ModerationPage />);
    await expectNoSeriousViolations(container, 'ModerationPage');
  });

  it('ModerationPage surfaces a friendly staff-required state on 403', async () => {
    mockedGetModerationStats.mockRejectedValue(new StaffApiError(403, 'STAFF_REQUIRED', 'Staff only'));
    const { container } = withProviders(<ModerationPage />);
    await expectNoSeriousViolations(container, 'ModerationPage 403');
  });

  it('ComponentShowcasePage has no critical/serious/moderate violations', async () => {
    const { container } = withProviders(<ComponentShowcasePage />);
    await expectNoSeriousViolations(container, 'ComponentShowcasePage');
  });

  it('NotFoundPage has no critical/serious/moderate violations', async () => {
    const { container } = withProviders(<NotFoundPage />);
    await expectNoSeriousViolations(container, 'NotFoundPage');
  });
});
