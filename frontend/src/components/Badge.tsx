import type { ReactNode } from 'react';

export interface BadgeProps {
  tone: 'neutral' | 'open' | 'closed' | 'draft' | 'warning';
  children: ReactNode;
}

const toneClasses: Record<BadgeProps['tone'], string> = {
  neutral: 'bg-slate-100 text-ink',
  open: 'bg-voted/10 text-voted',
  closed: 'bg-closed/10 text-closed',
  draft: 'bg-slate-100 text-slate-500',
  warning: 'bg-warning/10 text-warning',
};

export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      data-tone={tone}
      className={`inline-flex items-center rounded-[--radius-control] px-2 py-1 text-body-sm font-semibold uppercase tracking-wide ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
