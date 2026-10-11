import type { TimeSeriesPointDTO } from '@community/shared';

export interface SparklineProps {
  points: TimeSeriesPointDTO[];
  height?: number;
  label?: string;
}

/**
 * Simple dependency-free inline SVG bar series for zero-filled time-series
 * buckets. Purely presentational; no chart library.
 */
export function Sparkline({ points, height = 64, label }: SparklineProps) {
  const max = points.reduce((m, p) => Math.max(m, p.voteCount), 0);
  const width = Math.max(points.length * 6, 48);

  if (points.length === 0 || max === 0) {
    return (
      <div data-testid="sparkline-empty" className="text-body-sm text-slate-500">
        {label ?? 'No votes in this window'}
      </div>
    );
  }

  const barWidth = width / points.length;
  return (
    <div>
      <svg
        data-testid="sparkline"
        role="img"
        aria-label={label ?? `Vote activity series, peak ${max} votes per bucket`}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        className="block"
      >
        {points.map((point, index) => {
          const barHeight = Math.max((point.voteCount / max) * (height - 4), 1);
          return (
            <rect
              key={point.bucketStart}
              x={index * barWidth}
              y={height - barHeight}
              width={Math.max(barWidth - 1, 1)}
              height={barHeight}
              className="fill-chart-1"
            />
          );
        })}
      </svg>
      <p className="mt-1 text-body-sm text-slate-500">
        {points.length} buckets · peak {max} votes/bucket
      </p>
    </div>
  );
}
