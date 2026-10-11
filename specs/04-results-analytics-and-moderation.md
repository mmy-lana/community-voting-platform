# Results, Analytics & Moderation Feature Module

## 1. Results Aggregation Endpoints

### 1.1 Poll Results
- `GET /api/v1/polls/{id}/results/` -> 200 `ResultDTO`.
- Relational aggregation via `LEFT JOIN votes GROUP BY option`. Ties result in `winner: null`.

### 1.2 Live Tallies
- `GET /api/v1/polls/{id}/results/live/` -> 200 `ResultDTO`.
- Client uses TanStack Query `refetchInterval` adaptive sequence: 2s -> 5s -> 10s -> 30s.

### 1.3 Time Series
- `GET /api/v1/polls/{id}/results/timeseries/?granularity=hourly&from=ISO&to=ISO`
- `granularity`: `hourly` (default) | `daily`. Buckets in UTC via `date_trunc`. Response -> `TimeSeriesResponseDTO` containing `{ windowFrom: string, windowTo: string, points: TimeSeriesPointDTO[] }`. Sparse buckets are zero-filled client-side between `windowFrom` and `windowTo` for charting. Window capped at 30 days; 400 `VALIDATION_ERROR` otherwise.

## 2. Admin Moderation Workflows

All moderation endpoints require staff (session or bearer token); mutations record an audit log.

| Endpoint | Method | Purpose | Response |
|---|---|---|---|
| `/moderation/polls/{id}/status/` | POST | Transition poll status | 200 `PollDetailDTO` |
| `/moderation/votes/{id}/` | DELETE | Delete abusive vote | 204 |
| `/moderation/votes/` | GET | Filtered vote list | 200 `VoteDTO[]` + ListResponseMeta |
| `/moderation/votes/export/` | GET | CSV export | 200 `text/csv` |
| `/moderation/polls/bulk-status/` | POST | Transactional bulk close (max 50) | 200 `{ updated: n, skipped: [{id, reason}] }` |
| `/moderation/audit/` | GET | Moderation audit log | 200 `AuditLogDTO[]` + ListResponseMeta |
| `/moderation/stats/` | GET | System metrics | 200 `Record<string, number>` |

## 3. Filtering & Pagination

- Explicit server-side query validation.
- Standard pagination: `page` (1-based), `pageSize` (default 20, max 50). Meta matches `ListResponseMeta`.

## 4. Telemetry

- Structured JSON logging with `X-Request-Id` correlation.
- Request timing middleware logs DB queries and response durations.
- Telemetry ingestion at `POST /api/v1/telemetry/client-error/` (throttled 5/min/IP).

## 5. Error Handling

| Situation | Handling |
|---|---|
| DB unavailable during tally | 503 envelope `INTERNAL_ERROR` with `Retry-After: 5` |
| Throttled live polling | 429 adaptive backoff up to 60s |
| Moderation action conflict | 409 with details |
| Bulk action partial failure | On bulk failure, the primary transaction rolls back (no polls changed). Audit logging of the aborted attempt uses a separate database connection/transaction outside the rolled-back block (or post-rollback audit write in the exception handler). |
| Export too large | Hard cap at 100k rows; 400 if window too wide |
