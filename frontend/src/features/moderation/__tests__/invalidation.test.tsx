import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PollDTO } from '@community/shared';
import { ModerationPage } from '../ModerationPage';
import { ToastProvider } from '../../../components/Toast';
import {
  getModerationStats,
  listAuditLog,
  listVotes,
  setPollStatus,
} from '../api';
import { listPolls } from '../../polls/api';
import { useAppStore } from '../../../lib/store';
import { samplePoll } from '../../../test/fixtures';

vi.mock('../api', () => ({
  StaffApiError: class extends Error {
    status: number;
    constructor(status: number) {
      super('staff error');
      this.status = status;
    }
  },
  bulkSetPollStatus: vi.fn(),
  deleteVote: vi.fn(),
  exportVotesCsv: vi.fn(),
  getModerationStats: vi.fn(),
  listAuditLog: vi.fn(),
  listVotes: vi.fn(),
  setPollStatus: vi.fn(),
}));

vi.mock('../../polls/api', () => ({
  listPolls: vi.fn(),
  getPoll: vi.fn(),
  castVote: vi.fn(),
}));

const mockedSetPollStatus = vi.mocked(setPollStatus);
const mockedListPolls = vi.mocked(listPolls);
const mockedGetModerationStats = vi.mocked(getModerationStats);
const mockedListVotes = vi.mocked(listVotes);
const mockedListAuditLog = vi.mocked(listAuditLog);

const openPoll: PollDTO = {
  id: 7,
  title: 'Open poll',
  description: null,
  status: 'open',
  isAnonymous: true,
  allowRevote: false,
  opensAt: null,
  closesAt: null,
  totalVotes: 5,
  leadOptionLabel: 'Dark mode',
};

function makeClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Seed caches that a status change must invalidate.
  queryClient.setQueryData(['poll', 7], samplePoll);
  queryClient.setQueryData(['results', 7], { pollId: 7 });
  return queryClient;
}

function renderPage(queryClient: QueryClient) {
  useAppStore.setState({ staffToken: 'test-staff-token', staffSessionMode: false });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ModerationPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('ModerationPage cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetModerationStats.mockResolvedValue({ pollsTotal: 1 });
    mockedListPolls.mockResolvedValue([openPoll]);
    mockedListVotes.mockResolvedValue({
      results: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
    });
    mockedListAuditLog.mockResolvedValue({
      results: [],
      pagination: { page: 1, pageSize: 0, totalItems: 0, totalPages: 1 },
    });
  });

  it('invalidates polls, poll detail and results caches after closing a poll', async () => {
    const user = userEvent.setup();
    const queryClient = makeClient();
    mockedSetPollStatus.mockResolvedValue({ ...samplePoll, id: 7, status: 'closed' });

    renderPage(queryClient);

    expect(await screen.findByTestId('poll-controls')).toBeInTheDocument();
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    await user.click(closeButtons[0]);

    await waitFor(() => {
      expect(mockedSetPollStatus).toHaveBeenCalledWith(7, 'closed');
    });

    // ['poll', id] and ['results', id] were marked invalidated by the mutation.
    await waitFor(() => {
      expect(queryClient.getQueryState(['poll', 7])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['results', 7])?.isInvalidated).toBe(true);
    });
    // ['polls'] invalidated -> listPolls refetched (initial + post-mutation refetch).
    await waitFor(() => {
      expect(mockedListPolls.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('invalidates caches after reopening a closed poll', async () => {
    const user = userEvent.setup();
    const queryClient = makeClient();
    mockedListPolls.mockResolvedValue([{ ...openPoll, status: 'closed' as const }]);
    mockedSetPollStatus.mockResolvedValue({ ...samplePoll, id: 7, status: 'open' });

    renderPage(queryClient);

    expect(await screen.findByTestId('poll-controls')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reopen' }));

    await waitFor(() => {
      expect(mockedSetPollStatus).toHaveBeenCalledWith(7, 'open');
    });
    await waitFor(() => {
      expect(queryClient.getQueryState(['poll', 7])?.isInvalidated).toBe(true);
    });
  });
});
