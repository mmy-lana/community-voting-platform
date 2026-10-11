export interface ProgressBarProps {
  value: number;
  color?: string;
  label: string;
  size?: 'sm' | 'md';
}

export function ProgressBar({ value, color, label, size = 'md' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      data-testid="progress-bar"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="w-full"
    >
      <div
        className={[
          'w-full overflow-hidden rounded-full bg-slate-200',
          size === 'sm' ? 'h-1' : 'h-2',
        ].join(' ')}
      >
        <div
          data-testid="progress-fill"
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${clamped}%`, backgroundColor: color ?? 'var(--color-accent)' }}
        />
      </div>
    </div>
  );
}
