import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../components/Button';

describe('Button', () => {
  it('renders default state and handles clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button variant="primary" onClick={onClick}>
        Cast Vote
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Cast Vote' });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders disabled state and ignores clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button variant="primary" disabled onClick={onClick}>
        Cast Vote
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Cast Vote' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cast Vote' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders loading state with aria-busy and disabled', () => {
    render(
      <Button variant="primary" loading>
        Submitting
      </Button>,
    );
    expect(screen.getByRole('button', { name: /Submitting/ })).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('meets the 44px minimum touch target', () => {
    render(
      <Button variant="secondary" size="sm">
        Small
      </Button>,
    );
    expect(screen.getByRole('button')).toHaveClass('min-h-[44px]');
    expect(screen.getByRole('button')).toHaveClass('min-w-[44px]');
  });
});
