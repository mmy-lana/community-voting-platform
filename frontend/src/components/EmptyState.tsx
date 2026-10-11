import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className="flex flex-col items-center justify-center gap-3 rounded-[--radius-card] border border-dashed border-border bg-surface p-8 text-center"
    >
      <h3 className="text-title font-semibold text-ink">{title}</h3>
      {description ? <p className="max-w-sm text-body-lg text-slate-600">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
