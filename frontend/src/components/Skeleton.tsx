export interface SkeletonProps {
  variant: 'card' | 'bar-row' | 'text';
  count?: number;
}

const variantClasses: Record<SkeletonProps['variant'], string> = {
  card: 'h-32 w-full rounded-[--radius-card]',
  'bar-row': 'h-[--chart-bar-h] w-full rounded-[--radius-control]',
  text: 'h-4 w-3/4 rounded-full',
};

export function Skeleton({ variant, count = 1 }: SkeletonProps) {
  return (
    <div data-testid="skeleton" className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: Math.max(1, count) }, (_, index) => (
        <div key={index} className={`animate-pulse bg-slate-200 ${variantClasses[variant]}`} />
      ))}
    </div>
  );
}
