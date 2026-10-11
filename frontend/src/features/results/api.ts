import type { ResultDTO, TimeSeriesResponseDTO } from '@community/shared';
import { apiClient } from '../../lib/apiClient';

export type Granularity = 'hourly' | 'daily';

export interface TimeSeriesFilters {
  granularity?: Granularity;
  from?: string;
  to?: string;
}

export async function getResults(pollId: number | string): Promise<ResultDTO> {
  return apiClient.get<ResultDTO>(`/polls/${pollId}/results/`);
}

export async function getLiveResults(pollId: number | string): Promise<ResultDTO> {
  return apiClient.get<ResultDTO>(`/polls/${pollId}/results/live/`);
}

export async function getTimeSeries(
  pollId: number | string,
  filters: TimeSeriesFilters = {},
): Promise<TimeSeriesResponseDTO> {
  const params = new URLSearchParams();
  if (filters.granularity) params.set('granularity', filters.granularity);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const qs = params.toString();
  return apiClient.get<TimeSeriesResponseDTO>(`/polls/${pollId}/results/timeseries/${qs ? `?${qs}` : ''}`);
}
