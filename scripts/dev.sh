#!/usr/bin/env bash
# One command for local dev: DB stack, seed, edge functions, Vite. Ctrl-C stops the functions and the app.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  command -v colima >/dev/null && colima start
  docker info >/dev/null 2>&1 || { echo "Docker isn't running. Start it and retry." >&2; exit 1; }
fi

# Colima restarts leftover containers on its own, so start can fail with "not ready: starting"; wait for the stack instead.
npx supabase start || echo "Stack already starting, waiting for it..."
for _ in $(seq 60); do npx supabase status >/dev/null 2>&1 && break; sleep 2; done
npx supabase status >/dev/null 2>&1 || { echo "Supabase never became ready." >&2; exit 1; }
# Seed through the DB container so psql isn't required; inserts are idempotent.
docker exec -i supabase_db_web-wallet psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/seed.sql

trap 'kill 0' EXIT
npx supabase functions serve &
npx vite
