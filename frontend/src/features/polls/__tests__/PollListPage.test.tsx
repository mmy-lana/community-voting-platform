import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PollDTO } from '@community/shared';
import { PollListPage } from '../PollListPage';
import { listPolls } from '../api';

vi.mock('../api', () => ({
  listPolls: vi.fn(),
  getPoll: vi.fn(),
  castVote: vi.fn(),
}));

const mockedListPolls = vi.mocked(listPolls);

const seededPolls: PollDTO[] = [
  {
    id: 1,
    title: 'Favorite frontend framework?',
    description: null,
    status: 'open',
    isAnonymous: true,
    allowRevote: false,
    opensAt: null,
    closesAt: null,
    totalVotes: 42,
    leadOptionLabel: 'React',
  },
  {
    id: 2,
    title: 'Best summit location?',
    description: null,
    status: 'open',
    isAnonymous: true,
    allowRevote: false,
    opensAt: null,
    closesAt: null,
    totalVotes: 40,
    leadOptionLabel: 'Lisbon',
  },
  {
    id: 3,
    title: 'Launch merch design?',
    description: null,
    status: 'closed',
    isAnonymous: true,
    allowRevote: false,
    opensAt: null,
    closesAt: '2025-01-01T00:00:00Z',
    totalVotes: 120,
    leadOptionLabel: 'Hoodie',
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PollListPage />
    </QueryClientProvider>,
  );
}

describe('PollListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('renders seeded polls in the grid', async () => {
    mockedListPolls.mockResolvedValue(seededPolls);
    renderPage();

    expect(await screen.findByTestId('poll-grid')).toBeInTheDocument();
    const grid = screen.getByTestId('poll-grid');
    expect(within(grid).getAllByTestId('poll-card')).toHaveLength(3);
    expect(screen.getByText('Favorite frontend framework?')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('shows skeletons while loading', () => {
    mockedListPolls.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('poll-grid')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no polls', async () => {
    mockedListPolls.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('filters by status tabs through the status query param', async () => {
    const user = userEvent.setup();
    mockedListPolls.mockResolvedValue([]);
    renderPage();

    await screen.findByRole('tab', { name: 'All' });
    await user.click(screen.getByRole('tab', { name: 'Closed' }));

    await waitFor(() => {
      expect(mockedListPolls).toHaveBeenLastCalledWith({ status: 'closed' });
    });
    await waitFor(() => {
      expect(window.location.search).toBe('?status=closed');
    });

    await user.click(screen.getByRole('tab', { name: 'Open' }));
    await waitFor(() => {
      expect(mockedListPolls).toHaveBeenLastCalledWith({ status: 'open' });
    });
  });
});
