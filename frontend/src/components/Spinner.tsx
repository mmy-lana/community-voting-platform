export interface SpinnerProps {
  size?: 16 | 24 | 32;
  label?: string;
}

const sizeMap: Record<NonNullable<SpinnerProps['size']>, string> = {
  16: 'size-4 border-2',
  24: 'size-6 border-2',
  32: 'size-8 border-[3px]',
};

export function Spinner({ size = 24, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" data-testid="spinner" className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`inline-block animate-spin rounded-full border-current border-t-transparent text-accent ${sizeMap[size]}`}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
