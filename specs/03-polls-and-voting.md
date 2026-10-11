# Polls & Voting Feature Module

## 1. Vote Casting Algorithm

```
POST /api/v1/polls/{poll_id}/votes/
Headers: Idempotency-Key: <uuid-v4>

1. Parse + validate body {optionId} -> 400 VALIDATION_ERROR if malformed.
2. Check idempotency cache (poll_id, idempotency_key) -> if hit, return cached
   response with same status (201) and header Idempotency-Replayed: true
   (no second vote row).
3. BEGIN TRANSACTION (Use READ COMMITTED with SELECT ... FOR UPDATE on the poll row; full SERIALIZABLE isolation is not required and adds unnecessary contention):
   a. SELECT ... FROM polls WHERE id = {poll_id} FOR UPDATE;
      -> 404 NOT_FOUND if absent.
   b. Guard: status must be 'open' -> 409 POLL_NOT_OPEN.
   c. Guard: now() within [opens_at, closes_at] (if set);
      closes_at < now() -> 409 POLL_EXPIRED.
   d. Guard: optionId in poll options -> 400 OPTION_MISMATCH.
   e. Fast-path SELECT on (poll_id, voter_ip_hash);
      exists and not allow_revote -> 409 VOTE_DUPLICATE.
   e-ii. If exists and allow_revote = true:
      UPDATE votes SET option_id = {optionId} WHERE poll_id = {poll_id} AND voter_ip = {voter_ip_hash};
      skip INSERT; go to step 4.
   f. INSERT INTO votes (poll_id, option_id, voter_ip, idempotency_key) ...
      - UNIQUE (poll_id, voter_ip) violation -> ROLLBACK -> 409 VOTE_DUPLICATE.
      - UNIQUE (poll_id, idempotency_key) violation -> 409 IDEMPOTENCY_REPLAY
        (client retried with same key but cache expired; return original
        semantics without inserting).
4. COMMIT -> serialize VoteDTO -> 201 Created, envelope success=true.
5. Normalization: IPv6 -> RFC 5952; IPv4 literal; then
   voter_ip = sha256(normalized_ip + VOTE_HASH_SALT) hex (64 chars).
6. Concurrency: the FOR UPDATE poll lock serializes same-poll writers; the
   DB unique constraint is the final arbiter for races across replicas.
```

## 2. State Transitions

```
draft --(open: admin action or opens_at reached)--> open
open  --(close: admin action or closes_at passed)--> closed
closed --(reopen: admin moderation action only)--> open
```

## 3. REST Endpoint Contracts

Base: `http://localhost:8102/api/v1`. All route patterns below are registered under the Django `api/v1/` URL router prefix (e.g. `path('api/v1/', include(...))`). All responses use `ApiResponseEnvelope<T>` (or `ApiListResponseEnvelope<T>`).

### 3.1 List Polls
- `GET /polls/` — query: `status`, `search`, `ordering`, `page`, `pageSize`.
- 200 -> `PollDTO[]` + `ListResponseMeta`.

### 3.2 Poll Detail
- `GET /polls/{id}/` -> 200 `PollDetailDTO`. 404 `NOT_FOUND`.

### 3.3 Create / Update Poll (admin)
- `POST /polls/` body `PollWrite` -> 201 `PollDetailDTO`.
- `PATCH /polls/{id}/` -> 200 `PollDetailDTO`.
- `DELETE /polls/{id}/` -> 204.

### 3.4 Cast Vote
- `POST /polls/{poll_id}/votes/` body `{ "optionId": number }`, header `Idempotency-Key`.
- 201 -> `VoteDTO` (cached replay returns 201 with header `Idempotency-Replayed: true`). Errors: 400 `VALIDATION_ERROR` / `OPTION_MISMATCH`; 404 `NOT_FOUND`; 409 `VOTE_DUPLICATE` / `POLL_NOT_OPEN` / `POLL_EXPIRED` (and `IDEMPOTENCY_REPLAY` only when cache expired but DB key row already exists); 429 `RATE_LIMITED` (vote throttle 10/min/IP).

### 3.5 Results
- `GET /polls/{id}/results/` -> 200 `ResultDTO`.

### 3.6 Health
- `GET /health/` -> 200 `{ db: "up" }`.

### 3.7 Client Telemetry
- `POST /telemetry/client-error/` body `{ "route": string, "errorName": string, "requestId": string }`.
- 202 -> empty envelope `data: null`. Public endpoint (unauthenticated), throttled 5/min/IP.

## 4. Edge Cases

| Case | Behavior |
|---|---|
| Double voting (same IP, same poll) | Pre-check fast-path + UNIQUE constraint -> 409 `VOTE_DUPLICATE`; frontend shows inline "You already voted" with results link |
| Concurrent same-IP requests (race) | Poll row lock serializes; second insert violates UNIQUE -> 409; exactly one 201 |
| Poll expiry mid-session | Vote submitted after `closes_at` -> 409 `POLL_EXPIRED`; UI disables buttons when effective status is closed |
| Option deleted while voting | FK + OPTION_MISMATCH pre-check -> 400 |
| Retried request after network timeout | Same Idempotency-Key -> cached 201 replay, no duplicate row |
| Draft poll accessed via direct URL | 404 for anonymous; visible + editable for staff |
| `allow_revote = true` | Existing vote for (poll_id, voter_ip) is UPDATEd (option_id swap) in the same transaction; tallies stay consistent; still audited |
| IPv6 clients | Normalized per RFC 5952 before hashing; /64 prefix used for guard key to prevent trivial bypass within same subnet |
| Malformed/missing Idempotency-Key | Treated as fresh request; response header `X-Idempotency: absent` |
