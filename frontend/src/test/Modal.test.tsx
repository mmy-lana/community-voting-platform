import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';

function ModalHarness({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Open modal
      </Button>
      <Modal
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Confirm your vote"
        footer={
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        }
      >
        Once cast, your vote is final for this poll.
      </Modal>
    </div>
  );
}

async function openModal() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Open modal' }));
  return user;
}

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        Body
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders open with dialog semantics and focuses the first focusable element', async () => {
    render(<ModalHarness />);
    await openModal();
    const dialog = screen.getByRole('dialog', { name: 'Confirm your vote' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('modal-close')).toHaveFocus();
  });

  it('supports initialFocus="close"', async () => {
    render(<ModalHarness />);
    await openModal();
    expect(screen.getByTestId('modal-close')).toHaveFocus();
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    render(<ModalHarness />);
    const user = await openModal();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open modal' })).toHaveFocus();
  });

  it('closes via the close button and restores focus', async () => {
    render(<ModalHarness />);
    const user = await openModal();
    await user.click(screen.getByTestId('modal-close'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open modal' })).toHaveFocus();
  });

  it('traps Tab focus inside the dialog', async () => {
    render(<ModalHarness />);
    const user = await openModal();
    const dialog = screen.getByRole('dialog');
    const close = screen.getByTestId('modal-close');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    // Initial focus is the close button (first focusable). Tab to the last.
    expect(close).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    // Tab forward from the last focusable wraps to the first.
    await user.tab();
    expect(close).toHaveFocus();
    // Shift+Tab from the first focusable wraps to the last.
    await user.tab({ shift: true });
    expect(cancel).toHaveFocus();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
