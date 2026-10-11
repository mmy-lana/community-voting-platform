# Tasks Breakdown

Checklist — Tasks 1–6, executed in order. Each task must be verified before the next begins.

## Task 1 — Environment Baseline, Shared Contracts & DB Init

- [x] Scaffold Turborepo root with pnpm workspaces (`frontend`, `backend`, `packages/shared`, `docker`), `turbo.json` pipelines for build/dev/lint/test.
- [x] Initialize frontend: latest Vite + React + TypeScript (strict), Tailwind v4, port 5102 dev server.
- [x] Initialize backend: latest Django project `config`, DRF installed, pip `requirements.txt`, port 8102.
- [x] Configure Neon Postgres connection via `DATABASE_URL` (psycopg2, sslmode=require); verify connectivity on port 5402 tunnel.
- [x] Create `packages/shared` TypeScript DTOs + enums (PollDTO, OptionDTO, VoteDTO, ResultDTO, ApiResponseEnvelope<T>, PollStatus, ErrorCodes) consumed by frontend; mirrored by DRF serializer field naming.
- [x] Implement `apps/core`: EnvelopeRenderer, EnvelopeExceptionHandler, pagination, `X-Request-Id` middleware.
- [x] `db:init` + `db:migrate` management commands run clean against empty DB; `db:seed` seeds fixture polls/options (see specs/01-core.md seed requirements).
- [x] CORS allowlist set to `http://localhost:5102`; smoke test: FE fetches `/api/v1/polls/health` and renders envelope.

## Task 2 — Design System Primitives & Atomic UI

- [ ] Define design tokens in `frontend/src/styles/tokens.css` with Tailwind v4 `@theme` mapping (colors, spacing, radii, typography, bar-chart palette, high-contrast vote states).
- [ ] Build atomic components with typed props + Storybook-free visual checklist: Button, Badge, VoteCard, BarChart, ProgressBar, Modal, Toast, Skeleton, EmptyState, Spinner.
- [ ] All interactive elements >= 44x44px touch targets; keyboard reachable; ARIA roles per specs/02-ui-primitives.md.
- [ ] Responsive layout verified at 360 / 390 / 430 / 768 / 1024+ px breakpoints, mobile-first CSS ordering.
- [ ] Unit tests for components (Vitest latest + React Testing Library) covering states: default, hover, focus-visible, active, disabled, voted, closed.

## Task 3 — Feature Module 1: Polls & Vote Casting (End-to-End)

- [ ] Backend: `Poll`, `PollOption`, `Vote` models with DDL per specs/01-core.md (unique `(poll_id, voter_ip)`, status enum, FKs, indexes).
- [ ] DRF serializers (PollListSerializer, PollDetailSerializer, VoteCreateSerializer, nested options) + viewsets per specs/03-polls-and-voting.md.
- [ ] Vote casting transaction: `SELECT ... FOR UPDATE` poll row, status/expiry checks, insert with unique-constraint catch, `Idempotency-Key` cache, IP hash normalization.
- [ ] Frontend poll list page (grid of VoteCards, filter by status), poll detail page with vote interaction, optimistic update + rollback on 409.
- [ ] State transitions draft->open->closed enforced server-side; draft polls invisible to anonymous list/detail.
- [ ] Edge cases handled + tested: double vote, expired poll, closed poll, malformed IP, concurrent same-IP requests (race via concurrent test).
- [ ] E2E happy path: load -> vote -> see updated tally bar chart.

## Task 4 — Feature Module 2: Results, Analytics & Moderation (End-to-End)

- [ ] Results aggregation endpoints per specs/04-results-analytics-and-moderation.md: tallies (relational COUNT/GROUP BY), percentages, winner projection, time-series of votes per hour.
- [ ] Live tally polling on results page with adaptive interval; BarChart renders OptionDTO -> ResultDTO updates in place (no remount).
- [ ] Admin moderation: close/reopen poll, delete vote (with audit reason), bulk status change, audit log model + list view, staff-only permission classes.
- [ ] Filtering & pagination on admin vote list (by poll, IP-hash, date range, status); CSV export endpoint.
- [ ] Telemetry: structured JSON logging with requestId correlation, request timing middleware, vote-event counters.
- [ ] Error handling: rate-limited 429 toast, 500 fallback boundary on results widget, retry semantics documented.

## Task 5 — Routing Shell, Global State & Responsive Verification

- [ ] Router: `/` (poll list), `/polls/:id` (detail+vote), `/polls/:id/results`, `/moderation` (staff), 404 & error routes; lazy-loaded feature chunks.
- [ ] Global state wiring: Zustand `voteSession` hydration on navigation, TanStack Query cache invalidation after vote/close actions.
- [ ] Full responsive pass across all routes at 360/390/430/768/1024+; modal focus trap on mobile; safe-area insets honored.
- [ ] Accessibility audit: axe-clean on all routes; keyboard-only voting flow; prefers-reduced-motion disables bar animations.
- [ ] Cross-check envelope/error handling on every route (404 poll, network offline, 403 moderation).

## Task 6 — Production Docker Orchestration & Build Verification

- [ ] `docker/Dockerfile.frontend`: multi-stage (pnpm build -> nginx static), nginx proxying `/api` -> backend:8102.
- [ ] `docker/Dockerfile.backend`: multi-stage python:slim, gunicorn + whitegunicorn/static, migrate-on-start entrypoint.
- [ ] `docker-compose.yml`: services `frontend` (5102), `backend` (8102), postgres 5402 (Neon in prod — compose postgres only for local parity), healthchecks, depends_on conditions.
- [ ] Environment config: `.env.example` with DATABASE_URL, SECRET_KEY, VOTE_HASH_SALT, CORS_ORIGINS, DEBUG=false defaults.
- [ ] Full verification: `turbo build` clean; `docker compose up` serves FE on 5102, BE on 8102; seeded poll visible; vote casts; tally chart updates; moderation close works end-to-end.
- [ ] Security checklist final pass: headers present, CORS locked, DEBUG off, no stack traces, IP hashing active.
