import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast, type ToastMessage } from '../components/Toast';

function ToastHarness({ toast, autoDismissMs }: { toast: Omit<ToastMessage, 'id'>; autoDismissMs?: number }) {
  const { push } = useToast();
  return (
    <button type="button" onClick={() => push({ ...toast, autoDismissMs })}>
      Show toast
    </button>
  );
}

describe('Toast', () => {
  it('renders a pushed toast with role=status and the given tone', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastHarness toast={{ tone: 'success', message: 'Vote recorded' }} autoDismissMs={0} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Show toast' }));
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Vote recorded');
    expect(toast).toHaveAttribute('data-tone', 'success');
  });

  it('dismisses a toast via its close button', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastHarness toast={{ tone: 'error', message: 'Duplicate vote' }} autoDismissMs={0} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Show toast' }));
    await user.click(screen.getByRole('button', { name: /Dismiss: Duplicate vote/ }));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('auto-dismisses after autoDismissMs', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastHarness toast={{ tone: 'info', message: 'Refreshing' }} autoDismissMs={50} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Show toast' }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument(), { timeout: 2000 });
  });
});
