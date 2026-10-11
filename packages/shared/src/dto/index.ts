import type { PollStatus } from '../enums';

export interface OptionDTO {
  id: number;
  label: string;
  position: number;
  voteCount: number;
}

export interface PollDTO {
  id: number;
  title: string;
  description: string | null;
  status: PollStatus;
  isAnonymous: boolean;
  allowRevote: boolean;
  opensAt: string | null;
  closesAt: string | null;
  totalVotes: number;
  leadOptionLabel: string | null;
}

export interface PollDetailDTO extends PollDTO {
  options: OptionDTO[];
  createdBy: string;
  createdAt: string;
  /** Option the current voter (hashed IP) already chose on this poll, if any. */
  userVotedOptionId: number | null;
}

export interface VoteDTO {
  id: number;
  pollId: number;
  optionId: number;
  createdAt: string;
}

export interface ResultBucketDTO {
  optionId: number;
  label: string;
  voteCount: number;
  percentage: number;
}

export interface ResultDTO {
  pollId: number;
  status: PollStatus;
  totalVotes: number;
  results: ResultBucketDTO[];
  winner: { optionId: number; label: string } | null;
}

export interface TimeSeriesPointDTO {
  bucketStart: string;
  voteCount: number;
}

export interface TimeSeriesResponseDTO {
  windowFrom: string;
  windowTo: string;
  points: TimeSeriesPointDTO[];
}

export interface AuditLogDTO {
  id: number;
  actor: string;
  action: string;
  entityType: string;
  entityId: number;
  reason: string | null;
  createdAt: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]> | null;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
}

export interface ListResponseMeta extends ResponseMeta {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ApiResponseEnvelope<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: ResponseMeta | null;
}

export interface ApiListResponseEnvelope<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: ListResponseMeta | null;
}
