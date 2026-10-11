import type { ResultBucketDTO } from '@community/shared';

export interface BarChartProps {
  data: ResultBucketDTO[];
  highlightOptionId?: number | null;
  maxBarSize?: number;
  animate?: boolean;
  showCounts?: boolean;
  emptyLabel?: string;
}

const barColors = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
  'bg-chart-6',
];

export function BarChart({
  data,
  highlightOptionId = null,
  maxBarSize = 100,
  animate = true,
  showCounts = true,
  emptyLabel = 'No votes yet',
}: BarChartProps) {
  if (data.length === 0) {
    return (
      <div data-testid="bar-chart-empty" className="rounded-[--radius-control] border border-dashed border-border p-4 text-body-lg text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  const totalVotes = data.reduce((sum, bucket) => sum + bucket.voteCount, 0);
  const leader = data.reduce((a, b) => (b.percentage > a.percentage ? b : a), data[0]);
  const summary = `${leader.label} leads with ${leader.percentage}% of ${totalVotes} votes`;

  return (
    <div data-testid="bar-chart">
      <div role="img" aria-label={summary} className="flex flex-col gap-2">
        {data.map((bucket, index) => {
          const width = Math.min(bucket.percentage, maxBarSize);
          const highlighted = highlightOptionId === bucket.optionId;
          return (
            <div key={bucket.optionId} className="flex items-center gap-2">
              <span
                className="w-1/3 truncate text-body text-ink"
                title={bucket.label}
              >
                {bucket.label}
              </span>
              <div className="flex-1">
                <div
                  className={[
                    'h-[--chart-bar-h] rounded-[--radius-control]',
                    barColors[index % barColors.length],
                    highlighted ? 'ring-2 ring-ink ring-offset-1' : '',
                    animate ? 'transition-[width] duration-300' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ width: `${width}%` }}
                  data-percentage={bucket.percentage}
                />
              </div>
              {showCounts ? (
                <span className="w-16 text-right text-body-sm tabular-nums text-slate-600">
                  {bucket.percentage}%{totalVotes > 0 ? ` (${bucket.voteCount})` : ''}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Visually-hidden table fallback for screen readers. */}
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">Option</th>
            <th scope="col">Votes</th>
            <th scope="col">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {data.map((bucket) => (
            <tr key={bucket.optionId}>
              <th scope="row">{bucket.label}</th>
              <td>{bucket.voteCount}</td>
              <td>{bucket.percentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
