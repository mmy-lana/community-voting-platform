import { describe, expect, it } from 'vitest';
import { zeroFillTimeSeries } from '../timeseries';
import type { TimeSeriesResponseDTO } from '@community/shared';

describe('zeroFillTimeSeries', () => {
  it('zero-fills sparse hourly buckets between windowFrom and windowTo', () => {
    const series: TimeSeriesResponseDTO = {
      windowFrom: '2026-01-01T10:00:00Z',
      windowTo: '2026-01-01T14:00:00Z',
      points: [
        { bucketStart: '2026-01-01T10:00:00Z', voteCount: 3 },
        { bucketStart: '2026-01-01T13:00:00Z', voteCount: 7 },
      ],
    };
    const filled = zeroFillTimeSeries(series, 'hourly');
    expect(filled.map((p) => p.bucketStart)).toEqual([
      '2026-01-01T10:00:00.000Z',
      '2026-01-01T11:00:00.000Z',
      '2026-01-01T12:00:00.000Z',
      '2026-01-01T13:00:00.000Z',
      '2026-01-01T14:00:00.000Z',
    ]);
    expect(filled.map((p) => p.voteCount)).toEqual([3, 0, 0, 7, 0]);
  });

  it('zero-fills daily buckets', () => {
    const series: TimeSeriesResponseDTO = {
      windowFrom: '2026-01-01T00:00:00Z',
      windowTo: '2026-01-03T00:00:00Z',
      points: [{ bucketStart: '2026-01-02T00:00:00Z', voteCount: 5 }],
    };
    const filled = zeroFillTimeSeries(series, 'daily');
    expect(filled.map((p) => p.voteCount)).toEqual([0, 5, 0]);
  });

  it('returns empty for invalid window', () => {
    expect(
      zeroFillTimeSeries({ windowFrom: 'bad', windowTo: 'also-bad', points: [] }, 'hourly'),
    ).toEqual([]);
  });
});
