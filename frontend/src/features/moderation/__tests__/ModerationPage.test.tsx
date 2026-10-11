import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PollDTO } from '@community/shared';
import { ModerationPage } from '../ModerationPage';
import { ToastProvider } from '../../../components/Toast';
import {
  StaffApiError,
  bulkSetPollStatus,
  deleteVote,
  getModerationStats,
  listAuditLog,
  listVotes,
  setPollStatus,
} from '../api';
import { listPolls } from '../../polls/api';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    setPollStatus: vi.fn(),
    bulkSetPollStatus: vi.fn(),
    deleteVote: vi.fn(),
    listVotes: vi.fn(),
    listAuditLog: vi.fn(),
    getModerationStats: vi.fn(),
    exportVotesCsv: vi.fn(),
  };
});

vi.mock('../../polls/api', () => ({
  listPolls: vi.fn(),
}));

const mockSetPollStatus = vi.mocked(setPollStatus);
const mockBulk = vi.mocked(bulkSetPollStatus);
const mockDeleteVote = vi.mocked(deleteVote);
const mockListVotes = vi.mocked(listVotes);
const mockListAudit = vi.mocked(listAuditLog);
const mockStats = vi.mocked(getModerationStats);
const mockListPolls = vi.mocked(listPolls);

const polls: PollDTO[] = [
  {
    id: 1,
    title: 'Favorite framework?',
    description: null,
    status: 'open',
    isAnonymous: true,
    allowRevote: false,
    opensAt: null,
    closesAt: null,
    totalVotes: 10,
    leadOptionLabel: 'React',
  },
  {
    id: 2,
    title: 'Closed poll',
    description: null,
    status: 'closed',
    isAnonymous: true,
    allowRevote: false,
    opensAt: null,
    closesAt: '2025-01-01T00:00:00Z',
    totalVotes: 5,
    leadOptionLabel: 'A',
  },
];

const votes = {
  results: [
    {
      id: 7,
      pollId: 1,
      optionId: 11,
      voterIp: 'aabbccddeeff00112233',
      idempotencyKey: null,
      createdAt: '2026-01-05T10:00:00Z',
    },
  ],
  pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
};

const audit = {
  results: [
    {
      id: 3,
      actor: 'api-token',
      action: 'poll.close',
      entityType: 'poll',
      entityId: 1,
      reason: 'test reason',
      createdAt: '2026-01-05T09:00:00Z',
    },
  ],
  pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ModerationPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('ModerationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStats.mockResolvedValue({ pollsTotal: 2, votesTotal: 15 });
    mockListPolls.mockResolvedValue(polls);
    mockListVotes.mockResolvedValue(votes);
    mockListAudit.mockResolvedValue(audit);
  });

  it('renders stats, poll controls, audit log and vote table', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('audit-table')).toBeInTheDocument());
    expect(screen.getAllByTestId('stats-card').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('poll-controls')).toBeInTheDocument();
    expect(screen.getByTestId('votes-table')).toBeInTheDocument();
    expect(screen.getByText('poll.close')).toBeInTheDocument();
    expect(screen.getByText('test reason')).toBeInTheDocument();
  });

  it('close action calls setPollStatus API', async () => {
    mockSetPollStatus.mockResolvedValue({
      ...polls[0],
      status: 'closed',
    } as unknown as Awaited<ReturnType<typeof setPollStatus>>);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('poll-controls')).toBeInTheDocument());

    const buttons = screen.getAllByRole('button', { name: 'Close' });
    await user.click(buttons[0]);

    await waitFor(() => expect(mockSetPollStatus).toHaveBeenCalledTimes(1));
    expect(mockSetPollStatus).toHaveBeenCalledWith(1, 'closed');
  });

  it('renders staff-required EmptyState on 403', async () => {
    mockStats.mockRejectedValue(new StaffApiError(403, 'FORBIDDEN', 'staff required'));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());
    expect(screen.getByText('Staff required')).toBeInTheDocument();
  });

  it('vote delete requires reason and calls deleteVote with it', async () => {
    mockDeleteVote.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('votes-table')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const modal = await screen.findByTestId('modal');
    expect(modal).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Delete vote' });
    // reason required: empty -> disabled
    expect(confirmBtn).toBeDisabled();

    await user.type(screen.getByTestId('delete-reason'), 'ballot stuffing');
    expect(confirmBtn).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Delete vote' }));

    await waitFor(() => expect(mockDeleteVote).toHaveBeenCalledWith(7, 'ballot stuffing'), {
      timeout: 3000,
    });
  });

  it('429 on status change shows error toast', async () => {
    mockSetPollStatus.mockRejectedValue(new StaffApiError(429, 'THROTTLED', 'slow down'));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('poll-controls')).toBeInTheDocument());

    const buttons = screen.getAllByRole('button', { name: 'Close' });
    await user.click(buttons[0]);

    await waitFor(() => expect(mockSetPollStatus).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText(/Too many requests/)).toBeInTheDocument(),
    );
  });

  it('bulk close calls bulkSetPollStatus with selected ids', async () => {
    mockBulk.mockResolvedValue({ updated: 1, skipped: [] });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('poll-controls')).toBeInTheDocument());

    await user.click(screen.getByRole('checkbox', { name: 'Select poll 1' }));
    await user.click(screen.getByRole('button', { name: 'Bulk close selected' }));

    await waitFor(() => expect(mockBulk).toHaveBeenCalledWith([1], 'closed', expect.any(String)));
  });
});
