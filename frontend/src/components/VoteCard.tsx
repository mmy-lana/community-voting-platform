import { useId, useRef, type KeyboardEvent } from 'react';
import type { PollDetailDTO } from '@community/shared';
import { Badge } from './Badge';
import { Button } from './Button';

export interface VoteCardProps {
  poll: PollDetailDTO;
  selectedOptionId: number | null;
  hasVoted: boolean;
  onOptionSelect: (optionId: number) => void;
  onSubmitVote: (optionId: number) => void;
  disabled?: boolean;
  expiryLabel?: string;
  onOpenResults?: () => void;
}

export function VoteCard({
  poll,
  selectedOptionId,
  hasVoted,
  onOptionSelect,
  onSubmitVote,
  disabled = false,
  expiryLabel,
  onOpenResults,
}: VoteCardProps) {
  const groupId = useId();
  const optionsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const interactionsDisabled = disabled || hasVoted;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const enabled = optionsRef.current
      .map((el, index) => ({ el, index }))
      .filter(({ el }) => el !== null && !el.disabled);
    if (enabled.length === 0) return;
    const currentIdx = enabled.findIndex(({ el }) => el === document.activeElement);
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const next = enabled[(currentIdx + delta + enabled.length) % enabled.length];
    next.el?.focus();
  };

  return (
    <article
      data-testid="vote-card"
      data-state={hasVoted ? 'voted' : disabled ? 'disabled' : 'default'}
      className="rounded-[--radius-card] border border-border bg-surface p-4 shadow-sm md:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-title font-semibold text-ink">{poll.title}</h3>
        {expiryLabel ? <Badge tone={poll.status === 'closed' ? 'closed' : 'warning'}>{expiryLabel}</Badge> : null}
      </div>
      {poll.description ? <p className="mt-2 text-body-lg text-slate-600">{poll.description}</p> : null}

      <div
        role="radiogroup"
        aria-labelledby={groupId}
        aria-disabled={interactionsDisabled || undefined}
        onKeyDown={handleKeyDown}
        className="mt-4 flex flex-col gap-2"
      >
        <span id={groupId} className="sr-only">
          Poll options
        </span>
        {poll.options.map((option, index) => {
          const checked = selectedOptionId === option.id;
          return (
            <button
              key={option.id}
              ref={(el) => {
                optionsRef.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={interactionsDisabled}
              tabIndex={checked || (index === 0 && selectedOptionId === null) ? 0 : -1}
              onClick={() => onOptionSelect(option.id)}
              className={[
                'flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[--radius-control] border px-4 py-2 text-left text-body-lg',
                'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                checked ? 'border-voted bg-voted/10 text-voted font-semibold' : 'border-border bg-white hover:bg-slate-50',
                interactionsDisabled ? 'cursor-not-allowed opacity-60' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span>{option.label}</span>
              {checked ? (
                <span aria-hidden="true" className="text-voted">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          fullWidth
          disabled={interactionsDisabled || selectedOptionId === null}
          onClick={() => {
            if (selectedOptionId !== null) onSubmitVote(selectedOptionId);
          }}
        >
          {hasVoted ? 'Vote cast' : 'Cast Vote'}
        </Button>
        {onOpenResults ? (
          <Button variant="secondary" onClick={onOpenResults}>
            View Results
          </Button>
        ) : null}
      </div>
    </article>
  );
}
