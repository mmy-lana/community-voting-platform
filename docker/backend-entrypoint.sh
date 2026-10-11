#!/bin/sh
# Backend container entrypoint: wait for DB, migrate, seed, then serve.
set -e

cd /app/backend

# --- Wait for Postgres (parse host:port out of DATABASE_URL, fallback to db:5432) ---
DB_HOST="${POSTGRES_HOST:-db}"
DB_PORT="${POSTGRES_PORT:-5432}"
if [ -n "$DATABASE_URL" ]; then
    NO_PROTO="${DATABASE_URL#*://}"
    AUTH_HOST="${NO_PROTO%%/*}"
    HOSTPORT="${AUTH_HOST##*@}"
    HOSTPART="${HOSTPORT%%,*}"
    if [ -n "${HOSTPART%%:*}" ] && [ "${HOSTPART%%:*}" != "$HOSTPART" ]; then
        DB_HOST="${HOSTPART%%:*}"
        DB_PORT="${HOSTPART#*:}"
        DB_PORT="${DB_PORT%%\?*}"
    fi
fi

echo "Waiting for database at ${DB_HOST}:${DB_PORT}..."
python - "$DB_HOST" "$DB_PORT" <<'PYEOF'
import socket, sys, time
host, port = sys.argv[1], int(sys.argv[2])
for attempt in range(60):
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"Database {host}:{port} is up.")
            sys.exit(0)
    except OSError:
        time.sleep(1)
print(f"Database {host}:{port} did not become ready in time.", file=sys.stderr)
sys.exit(1)
PYEOF

echo "Running migrations..."
python manage.py migrate --noinput

echo "Seeding polls (idempotent)..."
python manage.py seed_polls

exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8102 \
    --workers 2 \
    --threads 4 \
    --timeout 60 \
    --access-logfile - \
    --error-logfile -
