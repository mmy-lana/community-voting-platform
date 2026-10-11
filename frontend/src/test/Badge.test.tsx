import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../components/Badge';

describe('Badge', () => {
  it.each(['neutral', 'open', 'closed', 'draft', 'warning'] as const)('renders the %s tone', (tone) => {
    render(<Badge tone={tone}>{tone}</Badge>);
    const badge = screen.getByText(tone);
    expect(badge).toHaveAttribute('data-tone', tone);
  });

  it('renders children text', () => {
    render(<Badge tone="open">Open for voting</Badge>);
    expect(screen.getByText('Open for voting')).toBeInTheDocument();
  });
});
