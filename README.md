# Community Voting Platform

High-contrast, privacy-preserving community polling engine built with React, Django REST Framework, and PostgreSQL. Features relational vote tallies, unique-IP voting protection, adaptive live telemetry, and an audited moderation console.

## Deployment Status

This project is currently not deployed to any public cloud or hosting environment (local run only) because the author has not bothered to set up deployment infrastructure yet.

## Architecture & Tech Stack

The repository is structured as a Turborepo monorepo using pnpm workspaces:

- Frontend (`frontend/`): React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query v5, Zustand. Runs on port 5102.
- Backend (`backend/`): Python 3.12, Django 5.1+, Django REST Framework, Gunicorn, WhiteNoise. Runs on port 8102.
- Shared Package (`packages/shared/`): Shared TypeScript DTOs, request envelopes, and status enums.
- Database: PostgreSQL (local port 5402 or managed Neon Postgres).
- Containerization (`docker/`): Multi-stage Dockerfiles with Nginx reverse proxy routing API traffic to the Django upstream.

## Core Features & Enterprise Hardening

- Privacy-Preserving Voting: Voter IPs are normalized (IPv6 /64 subnet prefixing) and hashed with SHA-256 and a deployment pepper salt. Raw IPs are never written to disk.
- Concurrency & Double-Vote Guard: Database-level `UNIQUE (poll_id, voter_ip)` constraint combined with `SELECT FOR UPDATE` row locks on the poll row to serialize concurrent same-IP vote attempts.
- Idempotent API Retries: Transparent 201 response replays with `Idempotency-Replayed: true` headers when matching client-provided UUID keys, backed by in-memory cache and database lookups.
- Adaptive Live Tallies: TanStack Query polling ladder (2s -> 5s -> 10s -> 30s) that backs off when responses are unchanged and terminates automatically once a poll closes.
- Staff Moderation Console: Authenticated via in-memory staff tokens or Django session cookies. Includes status toggling, transactional bulk closes, individual vote deletion with mandatory audit reasons, and formula-injection-safe CSV exports.
- Accessibility & Mobile Layout: Strict WCAG AA contrast compliance, keyboard-accessible radio groups, 44x44px minimum touch targets, and responsive single-column layouts down to 360px viewports.

## Prerequisites

- Node.js 22+ and pnpm 10+
- Python 3.12+
- Docker and Docker Compose

## Getting Started

### 1. Environment Configuration

Copy the sample environment file to the project root:

```bash
cp .env.example .env
```

Ensure the default settings or database credentials match your local setup:

- `DATABASE_URL=postgres://voting_user:voting_password@localhost:5402/voting_db`
- `CORS_ORIGINS=http://localhost:5102,http://127.0.0.1:5102`
- `SECRET_KEY=dev-insecure-secret-key`
- `STAFF_API_TOKEN=dev-staff-token`
- `DEBUG=true`

### 2. Docker Quickstart (Full Stack)

To run the complete platform including PostgreSQL, Django API, and Vite frontend via Docker:

```bash
docker compose -p cvp -f docker/docker-compose.yml up --build -d
```

- Web Application: http://localhost:5102
- API Endpoints: http://localhost:8102/api/v1/
- Database Tunnel: localhost:5402

### 3. Local Development Setup (Manual)

#### Start Database
```bash
docker compose -p cvp -f docker/docker-compose.yml up -d --wait db
```

#### Backend Setup
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

cd backend
python manage.py migrate
python manage.py seed_polls
python manage.py runserver 0.0.0.0:8102
```

#### Frontend Setup
```bash
# In project root
pnpm install
pnpm --filter @community/shared build
pnpm --filter frontend dev
```

Visit `http://localhost:5102` in your browser.

## Seeding & Fixtures

The backend includes an idempotent seeding command that creates four baseline polls (open, tie debate, draft, and closed historical) along with synthetic votes:

```bash
cd backend
python manage.py seed_polls
# Use --force to re-apply
python manage.py seed_polls --force
```

## Running Tests

### Frontend (Unit, Component & Accessibility)
```bash
pnpm --filter frontend test
```

### Backend (DRF Endpoints, Idempotency & Race Conditions)
```bash
cd backend
python manage.py test apps
```

### Headless Browser Audit
```bash
node scripts/verify-headless.mjs http://localhost:5102/
```

## Service Ports

| Component | Port | Description |
|-----------|------|-------------|
| Frontend | 5102 | Vite React development server / Nginx SPA |
| Backend | 8102 | Django REST Framework API (`/api/v1/`) |
| Database | 5402 | PostgreSQL container exposed port |
