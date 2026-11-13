#!/usr/bin/env bash
# One command for local dev: DB stack, seed, edge functions, Vite. Ctrl-C stops the functions and the app.
set -euo pipefail
cd "$(dirname "$0")/.."

docker info >/dev/null 2>&1 || { echo "Docker isn't running. Start it and retry." >&2; exit 1; }

npx supabase start
# Seed through the DB container so psql isn't required; inserts are idempotent.
docker exec -i supabase_db_web-wallet psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/seed.sql

trap 'kill 0' EXIT
npx supabase functions serve &
npx vite
