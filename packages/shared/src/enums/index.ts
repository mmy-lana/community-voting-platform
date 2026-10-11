export type PollStatus = 'draft' | 'open' | 'closed';

export type SortOrder = 'asc' | 'desc';

export type ErrorCodes =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'POLL_NOT_OPEN'
  | 'POLL_EXPIRED'
  | 'VOTE_DUPLICATE'
  | 'OPTION_MISMATCH'
  | 'RATE_LIMITED'
  | 'AUTH_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'IDEMPOTENCY_REPLAY'
  | 'INTERNAL_ERROR';
