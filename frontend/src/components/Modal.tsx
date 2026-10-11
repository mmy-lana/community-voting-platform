import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  role?: 'dialog' | 'alertdialog';
  initialFocus?: 'first' | 'close';
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  role = 'dialog',
  initialFocus = 'first',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTarget =
      initialFocus === 'close' ? closeButtonRef.current : dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusTarget ?? closeButtonRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
      previouslyFocused.current = null;
    };
  }, [open, onClose, initialFocus]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 md:items-center">
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-label={title}
        data-testid="modal"
        className="w-full max-w-[560px] rounded-[--radius-card] border border-border bg-surface p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-title font-semibold text-ink">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            data-testid="modal-close"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[--radius-control] text-ink outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-accent"
          >
            ✕
          </button>
        </div>
        <div className="mt-3 text-body-lg text-slate-700">{children}</div>
        {footer ? <div className="mt-5 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
