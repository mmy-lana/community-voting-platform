import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../components/ProgressBar';

describe('ProgressBar', () => {
  it('renders default state with ARIA progress semantics', () => {
    render(<ProgressBar value={72} label="Votes counted" />);
    const bar = screen.getByRole('progressbar', { name: 'Votes counted' });
    expect(bar).toHaveAttribute('aria-valuenow', '72');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps values outside 0..100', () => {
    const { rerender } = render(<ProgressBar value={150} label="Clamped high" />);
    expect(screen.getByRole('progressbar', { name: 'Clamped high' })).toHaveAttribute('aria-valuenow', '100');
    rerender(<ProgressBar value={-20} label="Clamped low" />);
    expect(screen.getByRole('progressbar', { name: 'Clamped low' })).toHaveAttribute('aria-valuenow', '0');
  });

  it('supports a custom color and small size', () => {
    render(<ProgressBar value={50} color="#059669" size="sm" label="Small" />);
    expect(screen.getByTestId('progress-fill')).toHaveStyle({ backgroundColor: '#059669' });
  });
});
