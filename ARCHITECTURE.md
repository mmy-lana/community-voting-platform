# Community Polling & Voting Engine — Master Specification

SLUG: `community-voting-platform`
STACK: React (Vite) + Python (Django + DRF) + Neon Postgres
PORTS: FE `5102` | BE `8102` | DB `5402`
THEME: High-contrast voting cards with bar charts
NOTES: Relational vote tallies, unique-IP voting guards, DRF serializers.

## 1. Monorepo Topology (Turborepo)

```
community-voting-platform/
├── turbo.json                     # Task pipeline: build, dev, lint, test, db:*
├── package.json                   # pnpm workspaces root, latest pnpm + Node LTS
├── pnpm-workspace.yaml            # packages: ["frontend", "backend", "packages/*", "docker"]
├── frontend/                      # React SPA (Vite), port 5102
│   ├── src/
│   │   ├── app/                   # Router shell, providers, error boundaries
│   │   ├── features/
│   │   │   ├── polls/             # Feature Module 1: browse, detail, vote casting
│   │   │   └── results/           # Feature Module 2: live tallies, analytics, moderation
│   │   ├── components/            # Atomic UI primitives (design-system package re-exports)
│   │   ├── lib/apiClient.ts       # Unified API client + ApiResponseEnvelope handling
│   │   ├── lib/store.ts           # Global state store
│   │   └── styles/tokens.css      # Tailwind v4 @theme token mapping
├── backend/                       # Django + DRF project, port 8102
│   ├── config/                    # settings (base/dev/prod), urls, asgi/wsgi
│   ├── apps/
│   │   ├── core/                  # ApiResponseEnvelope renderer, pagination, middleware
│   │   ├── polls/                 # Models: Poll, PollOption, Vote; serializers; viewsets
│   │   ├── results/               # Aggregation endpoints, tally snapshots, analytics
│   │   └── moderation/            # Admin workflows, audit log, telemetry
│   ├── migrations/
│   ├── management/commands/       # seed_polls.py, init_db.py
│   └── requirements.txt           # Django latest, DRF latest, psycopg2 (Neon driver), pip
├── packages/
│   └── shared/                    # Shared DTOs + status enums (TypeScript), zod schemas
│       ├── src/dto/               # PollDTO, OptionDTO, VoteDTO, ResultDTO, ApiResponseEnvelope<T>
│       └── src/enums/             # PollStatus, SortOrder, ErrorCodes
├── docker/
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   ├── docker-compose.yml         # FE 5102, BE 8102, DB 5402
│   └── nginx.conf
└── .env.example                   # DATABASE_URL, CORS_ORIGINS, SECRET_KEY, ports
```

### 1.1 Pipeline (turbo.json)

- `build`: frontend -> `vite build`; backend -> `python manage.py collectstatic --noinput` + `python -m compileall`; packages/shared -> `tsc -b`.
- `dev`: frontend on `5102`, backend on `8102` (Django dev server bound to `0.0.0.0:8102`).
- `db:init`, `db:migrate`, `db:seed`: backend `manage.py` commands via `DATABASE_URL`.
- `test`, `lint` parallelized by Turborepo with remote-cacheable hashes.

### 1.2 Ports

| Service   | Port | Notes |
|-----------|------|-------|
| Frontend  | 5102 | Vite dev server; CORS origin `http://localhost:5102` |
| Backend   | 8102 | Django + DRF under `/api/v1/` |
| Postgres  | 5402 | Neon Postgres via connection pooler; local psql tunnel exposed on 5402 |

## 2. Toolchain

- **Node**: latest LTS; **pnpm**: latest; **React**: latest; **Vite**: latest; **TypeScript**: latest (strict mode).
- **Frontend Dependencies**: `uuid` and `@types/uuid` explicitly declared in `frontend/package.json`.
- **Path Aliases**: `tsconfig.json` paths alias `@community/shared` -> `../../packages/shared/src`; mirrored in `vite.config.ts` `resolve.alias`.
- **Python**: latest stable (3.12+); **pip** with `requirements.txt`; **Django**: latest; **Django REST Framework**: latest; **djangorestframework-camel-case**: latest (camelCase wire formatting).
- **Database driver**: `psycopg2-binary` (latest) against Neon Postgres using pooled connection string (`?sslmode=require&pgbouncer=true`).
- **Tailwind CSS**: v4 (CSS-first `@theme` configuration, no `tailwind.config.js` needed).
- **Turborepo**: latest; **docker compose**: latest spec.

## 3. Global Data Layer

### 3.1 Unified Envelope

Every HTTP response — success or failure — uses the standardized envelope structures. See `packages/shared/src/dto/` — canonical source of truth for all envelope types (`ApiResponseEnvelope<T>`, `ApiListResponseEnvelope<T>`, `ApiError`, `ResponseMeta`, `ListResponseMeta`).

Backend implements this via a custom DRF renderer (`EnvelopeRenderer`), custom paginator (`EnvelopePagination`), and exception handler (`EnvelopeExceptionHandler`) in `apps/core/`:
- `EnvelopePagination` (extending `PageNumberPagination`) sets `response.list_envelope = True` and populates `response.pagination_meta = { page, pageSize, totalItems, totalPages }`.
- `EnvelopeRenderer` inspects `getattr(response, 'list_envelope', False)`: when `True`, it constructs and outputs `ListResponseMeta` using `response.pagination_meta`; otherwise, it emits `ResponseMeta`.

### 3.2 API Client (frontend)

- Single `apiClient` wrapping `fetch` with: base URL `http://localhost:8102/api/v1`, JSON serialization, `X-Request-Id` generation (uuid v4 per request), timeout (10s), automatic envelope unwrapping, typed `ApiError` rejection, and retry (idempotent GETs only, max 2, exponential backoff).

### 3.3 State Store

- Server state: TanStack Query (latest) keyed by entity (`polls`, `poll:<id>`, `results:<id>`), stale-while-revalidate; live tallies poll via `refetchInterval` with adaptive backoff (2s -> 5s -> 10s -> 30s).
- Client state: Zustand (latest) slices — `voteSession` (pollId -> local vote state, optimistic status), `ui` (modal, theme), `auth` (session token).
- Optimistic updates on vote casting; rollback + error toast on `409 VOTE_DUPLICATE`.

## 4. Security

### 4.1 Auth Strategy

- Public read access to open polls; vote casting is anonymous but IP-guarded (Section 4.3).
- Admin/moderation endpoints use Django session auth (admin UI) plus a staff API token (`Authorization: Bearer <token>`) for programmatic access; tokens stored hashed.
- Passwords hashed with Django's default (Argon2); admin-created via `createsuperuser`.
- CSRF: session-authenticated mutating endpoints require `X-CSRFToken`; pure API bearer paths exempt.

### 4.2 CORS

- `django-cors-headers` (latest), explicit allowlist: `http://localhost:5102` (and `http://127.0.0.1:5102` for dev). Never use wildcard. `CORS_ALLOW_CREDENTIALS=True` for session flows. Preflight cache 1h.

### 4.3 Rate Limiting & Unique-IP Voting Guard

- DRF throttle scopes: `anon` = 60/min, `vote` = 10/min per IP, `results` = 120/min.
- **Unique-IP vote guard**: DB-level constraint `UNIQUE (poll_id, voter_ip)` on `votes` (see specs/01-core.md) is the source of truth; application-level pre-check is a fast-path only. Hashed storage: `voter_ip` stored as SHA-256 of IP + per-deployment salt (pepper in env `VOTE_HASH_SALT`) to preserve uniqueness without storing raw IPs (privacy). IPv6 normalized (RFC 5952) before hashing. `IntegrityError` on insert -> `409 VOTE_DUPLICATE`.
- Idempotency: client sends `Idempotency-Key` header (uuid) per vote attempt; backend caches response per (poll_id, key) for 10 min so network retries never double-count.

### 4.4 Error Boundaries & Hardening

- React: top-level `ErrorBoundary` per route + per-widget (BarChart) boundary with fallback UI and retry.
- Backend: centralized exception handler maps `ValidationError->400`, `PermissionDenied->403`, `NotFound->404`, `IntegrityError->409/500` with safe codes; no stack traces in prod; `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` in prod settings.
- Input validation: DRF serializer validation only; parameterized ORM queries (never raw SQL string interpolation).
