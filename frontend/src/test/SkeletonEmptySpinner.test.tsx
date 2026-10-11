import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';

describe('Skeleton', () => {
  it('renders a single skeleton by default', () => {
    render(<Skeleton variant="text" />);
    expect(screen.getByTestId('skeleton').children).toHaveLength(1);
  });

  it('renders the requested count and variant', () => {
    render(<Skeleton variant="bar-row" count={3} />);
    expect(screen.getByTestId('skeleton').children).toHaveLength(3);
  });

  it('is hidden from assistive technology', () => {
    render(<Skeleton variant="card" />);
    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('EmptyState', () => {
  it('renders title only', () => {
    render(<EmptyState title="No polls yet" />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No polls yet');
    expect(screen.queryByText(/community/i)).not.toBeInTheDocument();
  });

  it('renders description and action', () => {
    render(
      <EmptyState
        title="No polls yet"
        description="Polls created by the community will appear here."
        action={<button type="button">Create poll</button>}
      />,
    );
    expect(screen.getByText('Polls created by the community will appear here.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create poll' })).toBeInTheDocument();
  });
});

describe('Spinner', () => {
  it('renders with a screen-reader label and role=status', () => {
    render(<Spinner size={32} label="Loading results" />);
    const spinner = screen.getByTestId('spinner');
    expect(spinner).toHaveAttribute('role', 'status');
    expect(spinner).toHaveTextContent('Loading results');
  });

  it('renders all supported sizes', () => {
    const { rerender } = render(<Spinner size={16} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    rerender(<Spinner size={24} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    rerender(<Spinner size={32} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
});
