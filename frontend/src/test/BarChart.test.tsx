import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BarChart } from '../components/BarChart';
import { sampleResults } from './fixtures';

describe('BarChart', () => {
  it('renders default state with an accessible summary label', () => {
    render(<BarChart data={sampleResults} />);
    const chart = screen.getByRole('img');
    expect(chart).toBeInTheDocument();
    expect(chart).toHaveAttribute('aria-label', 'Dark mode leads with 45% of 128 votes');
  });

  it('renders a visually-hidden table fallback', () => {
    render(<BarChart data={sampleResults} />);
    const table = screen.getByRole('table', { hidden: true });
    expect(table).toHaveClass('sr-only');
    expect(screen.getByRole('row', { name: /Dark mode 58 45%/i, hidden: true })).toBeInTheDocument();
  });

  it('renders counts when showCounts is true and omits them when false', () => {
    const { unmount } = render(<BarChart data={sampleResults} showCounts />);
    expect(screen.getAllByText(/45%/).length).toBeGreaterThan(0);
    unmount();
    render(<BarChart data={sampleResults} showCounts={false} />);
    expect(screen.queryByText('(58)')).not.toBeInTheDocument();
  });

  it('highlights the requested option', () => {
    render(<BarChart data={sampleResults} highlightOptionId={12} />);
    expect(screen.getAllByText('Notifications').length).toBeGreaterThan(0);
  });

  it('renders the empty state', () => {
    render(<BarChart data={[]} emptyLabel="No tallies yet" />);
    expect(screen.getByTestId('bar-chart-empty')).toHaveTextContent('No tallies yet');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
