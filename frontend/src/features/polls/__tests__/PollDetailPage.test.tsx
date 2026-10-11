import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PollDetailPage } from '../PollDetailPage';
import { ToastProvider } from '../../../components/Toast';
import { castVote, getPoll } from '../api';
import { ApiError } from '../../../lib/apiClient';
import { useAppStore } from '../../../lib/store';
import { samplePoll } from '../../../test/fixtures';

vi.mock('../api', () => ({
  listPolls: vi.fn(),
  getPoll: vi.fn(),
  castVote: vi.fn(),
}));

const mockedGetPoll = vi.mocked(getPoll);
const mockedCastVote = vi.mocked(castVote);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider><PollDetailPage pollId={1} /></ToastProvider>
    </QueryClientProvider>,
  );
}

describe('PollDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ votes: {} });
  });

  it('renders the poll and casts a vote (happy path with optimistic selection + invalidation)', async () => {
    const user = userEvent.setup();
    mockedGetPoll.mockResolvedValue({ ...samplePoll, id: 1 });
    mockedCastVote.mockResolvedValue({
      id: 9,
      pollId: 1,
      optionId: 11,
      createdAt: '2026-02-01T00:00:00Z',
    });
    renderPage();

    // Option selection is optimistic: radio reflects the pick immediately.
    await screen.findByRole('radio', { name: /dark mode/i });
    await user.click(screen.getByRole('radio', { name: /dark mode/i }));
    expect(screen.getByRole('radio', { name: /dark mode/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Cast Vote' }));

    await waitFor(() => {
      expect(mockedCastVote).toHaveBeenCalledWith(1, 11);
    });
    expect(await screen.findByTestId('vote-success')).toBeInTheDocument();
    // Success state: VoteCard flips to voted/disabled interactions.
    expect(screen.getByTestId('vote-card')).toHaveAttribute('data-state', 'voted');
    // ['poll', id] cache was invalidated (refetched after the mutation).
    await waitFor(() => {
      expect(mockedGetPoll.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('locks the card as voted and keeps the selection on 409 VOTE_DUPLICATE', async () => {
    const user = userEvent.setup();
    mockedGetPoll.mockResolvedValue({ ...samplePoll, id: 1 });
    mockedCastVote.mockRejectedValue(
      new ApiError(409, {
        code: 'VOTE_DUPLICATE',
        message: 'Vote already recorded for this poll.',
        details: null,
      }),
    );
    renderPage();

    await screen.findByRole('radio', { name: /dark mode/i });
    await user.click(screen.getByRole('radio', { name: /notifications/i }));
    await user.click(screen.getByRole('button', { name: 'Cast Vote' }));

    expect(await screen.findByTestId('vote-duplicate')).toHaveTextContent(/You already voted/i);
    expect(screen.getByRole('link', { name: /view results/i })).toBeInTheDocument();
    // The attempted option is retained and highlighted: the card locks as voted.
    expect(screen.getByTestId('vote-card')).toHaveAttribute('data-state', 'voted');
    expect(screen.getByRole('radio', { name: /notifications/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('disables voting on a closed poll', async () => {
    mockedGetPoll.mockResolvedValue({
      ...samplePoll,
      id: 1,
      status: 'closed',
      closesAt: '2020-01-01T00:00:00Z',
    });
    renderPage();

    expect(await screen.findByTestId('vote-card')).toHaveAttribute('data-state', 'disabled');
    expect(screen.getByRole('button', { name: 'Cast Vote' })).toBeDisabled();
  });
});
