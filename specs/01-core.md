# Core Specification

## 1. PostgreSQL DDL (Neon Postgres, latest)

```sql
-- Enums
CREATE TYPE poll_status AS ENUM ('draft', 'open', 'closed');

-- Polls
CREATE TABLE polls (
    id              BIGSERIAL PRIMARY KEY,
    title           VARCHAR(200)  NOT NULL,
    description     TEXT          NULL,
    status          poll_status   NOT NULL DEFAULT 'draft',
    is_anonymous    BOOLEAN       NOT NULL DEFAULT TRUE,
    allow_revote    BOOLEAN       NOT NULL DEFAULT FALSE,
    opens_at        TIMESTAMPTZ   NULL,
    closes_at       TIMESTAMPTZ   NULL,
    created_by      VARCHAR(150)  NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_poll_window CHECK (
        closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at
    ),
    CONSTRAINT chk_poll_title_len CHECK (char_length(trim(title)) >= 3)
);

CREATE INDEX idx_polls_status        ON polls (status);
CREATE INDEX idx_polls_status_opens  ON polls (status, opens_at);
CREATE INDEX idx_polls_created_at    ON polls (created_at DESC);

-- Options
CREATE TABLE options (
    id          BIGSERIAL PRIMARY KEY,
    poll_id     BIGINT       NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    label       VARCHAR(150) NOT NULL,
    position    SMALLINT     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uniq_option_per_poll UNIQUE (poll_id, label),
    CONSTRAINT chk_option_label CHECK (char_length(trim(label)) >= 1)
);

CREATE INDEX idx_options_poll ON options (poll_id, position);

-- Votes (unique-IP guard at DB level)
CREATE TABLE votes (
    id           BIGSERIAL PRIMARY KEY,
    poll_id      BIGINT      NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id    BIGINT      NOT NULL REFERENCES options(id) ON DELETE CASCADE,
    voter_ip     CHAR(64)    NOT NULL,  -- SHA-256 hex of normalized IP + salt
    idempotency_key VARCHAR(64) NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uniq_vote_per_poll_voter UNIQUE (poll_id, voter_ip)
);

CREATE UNIQUE INDEX uniq_vote_idempotency ON votes (poll_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_votes_poll_option  ON votes (poll_id, option_id);
CREATE INDEX idx_votes_created_at   ON votes (created_at DESC);
CREATE INDEX idx_votes_poll_created ON votes (poll_id, created_at DESC);
CREATE INDEX idx_votes_voter_ip     ON votes (voter_ip);
CREATE INDEX idx_votes_ip_poll      ON votes (voter_ip, poll_id);

-- Tally snapshots (optional cache; source of truth is relational aggregation)
CREATE TABLE tally_snapshots (
    id          BIGSERIAL PRIMARY KEY,
    poll_id     BIGINT      NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id   BIGINT      NOT NULL REFERENCES options(id) ON DELETE CASCADE,
    vote_count  INTEGER     NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uniq_snapshot UNIQUE (poll_id, option_id, captured_at)
);

CREATE INDEX idx_tally_snapshots_poll_time ON tally_snapshots (poll_id, captured_at DESC);

-- Moderation audit log
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    actor       VARCHAR(150) NOT NULL,
    action      VARCHAR(50)  NOT NULL,        -- e.g. 'poll.close', 'vote.delete'
    entity_type VARCHAR(50)  NOT NULL,
    entity_id   BIGINT       NOT NULL,
    reason      TEXT         NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity   ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_time     ON audit_log (created_at DESC);
```

## 2. DRF Serializers (apps/polls/serializers.py, apps/results, apps/moderation)

| Serializer | Fields | Behavior |
|---|---|---|
| `OptionSerializer` | id, label, position, vote_count (read-only) | vote_count annotated from aggregation query |
| `PollListSerializer` | id, title, status, opens_at, closes_at, total_votes, lead_option_label | Optimized list projection; `annotate` counts |
| `PollDetailSerializer` | list fields + description, is_anonymous, allow_revote, options[] (nested OptionSerializer), created_by, created_at | Nested read; contains per-option tallies for chart |
| `PollWriteSerializer` (admin) | title, description, status, opens_at, closes_at, is_anonymous, allow_revote, options[] writable | Validates poll window, min 2 options on open |
| `VoteCreateSerializer` | option_id | Validates: poll open & not expired; option belongs to poll; performs guarded insert. `poll_id` is injected from URL kwargs via `get_serializer_context`, not a serializer field; body contains only `option_id`. |
| `ResultSerializer` | poll_id, status, total_votes, results[] {option_id, label, vote_count, percentage}, winner | percentage rounded 1 decimal, sums to 100 +-0.1 |
| `TimeSeriesPointSerializer` | bucket_start, vote_count | hourly buckets, UTC |
| `TimeSeriesResponseSerializer` | window_from, window_to, points[] (nested TimeSeriesPointSerializer) | maps to TimeSeriesResponseDTO |
| `AuditLogSerializer` | id, actor, action, entity_type, entity_id, reason, created_at | read-only |
| `ModerationActionSerializer` | action (enum), entity_id, reason (required for destructive) | dispatches moderation service |

Note: `total_votes` and `lead_option_label` on `PollListSerializer` must use `.annotate(total_votes=Count('votes'), ...)` on the queryset; never computed per-instance.
All serializers are wrapped by `EnvelopeRenderer` -> `ApiResponseEnvelope<T>` (or `ApiListResponseEnvelope<T>` for lists); DRF `ValidationError` is transformed to `error.details` with stable `ErrorCodes`.

## 3. Seed Requirements (`manage.py seed_polls`)

- Idempotent (`--force` to reseed): upsert by natural key (poll title).
- Seed 4 polls: (1) open poll "Favorite frontend framework?" with 4 options + ~40 distributed votes from synthetic hashed IPs; (2) open poll with 2 options, near-tie; (3) `draft` poll with 3 options, zero votes; (4) `closed` poll with past closes_at and 120 votes.
- Synthetic voter IPs use deterministic salt via a separate `SEED_VOTE_SALT` env var (never `VOTE_HASH_SALT`) so unique constraint holds across reseeds without colliding with live voter hashes.
- Seeds run in a transaction; fail loudly on constraint violation.

## 4. TypeScript DTOs (packages/shared)

```ts
export type PollStatus = 'draft' | 'open' | 'closed';

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
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
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
```

## 5. Request / Response Models

| Action | Request body | Response `data` |
|---|---|---|
| List polls | query: `status`, `search`, `page`, `pageSize`, `ordering` | `PollDTO[]` + meta.pagination |
| Poll detail | None | `PollDetailDTO` |
| Create/update poll (admin) | `PollWrite` JSON | `PollDetailDTO` |
| Cast vote | `{ "optionId": 42 }` + `Idempotency-Key` header | `VoteDTO` |
| Results | query: `granularity=hourly&from&to` | `ResultDTO` |
| Time series | query: `granularity=hourly&from&to` | `TimeSeriesResponseDTO` |
| Moderation action | `{ "action": "poll.close", "entityId": 7, "reason": "..." }` | `AuditLogDTO` |

## 6. Status Enumerations

- **PollStatus**: `draft` -> `open` -> `closed`
- **HTTP codes used**: 200, 201, 204, 400, 401, 403, 404, 409, 429, 500.
- **ErrorCodes**: `VALIDATION_ERROR`, `NOT_FOUND`, `POLL_NOT_OPEN`, `POLL_EXPIRED`, `VOTE_DUPLICATE`, `OPTION_MISMATCH`, `RATE_LIMITED`, `AUTH_REQUIRED`, `PERMISSION_DENIED`, `IDEMPOTENCY_REPLAY`, `INTERNAL_ERROR`.
