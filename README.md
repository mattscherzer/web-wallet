# Treasury Wallet

A mobile-first Progressive Web App for tracking treasury funds across multiple accounts.

## Features

- 💰 **Dashboard** — Total balance + per-account breakdown (Cash, PayPal, Bank)
- ➕ **Add Money** — Record inflows with date, reason, payment method, and cash calculator
- ➖ **Add Expense** — Record outflows with categories and notes
- 📜 **Transaction History** — Search, filter (All/Inflows/Outflows), and review past transactions
- 🔢 **Cash Calculator** — Count bills and coins (€0.01 to €50) to calculate totals
- 🔒 **Owner & staff login** — owners sign in with email and password, staff with a username and 6-digit PIN; people only see the wallets they belong to; every entry records who made it; the app locks after 30 minutes of no use
- 📝 **Audit Trail** — Full change history for every transaction
- 📱 **Installable PWA** — Installs on mobile; the app shell is cached, the data needs a connection

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Supabase**: Postgres with row-level security, Auth and Edge Functions
- **React Router 7** (client-side routing)
- **Lucide React** (icons)
- **vite-plugin-pwa** (service worker + manifest)
- **Vanilla CSS** with custom properties
- **Vitest** with jsdom for UI tests and PGlite (real Postgres in WASM) for migration tests

## Architecture

Dependencies point down; a layer never imports from a layer above it.

```
app/          composition root: App, routes, auth and wallet gates
pages/        screens
components/   reusable UI
auth/ wallet/ hooks/   app state: providers, contexts, hooks
db/           platform/                Supabase adapters, browser adapters (no React)
domain/       utils/                   pure code
```

- `app/`: wires everything together; the only layer allowed to import any other.
- `pages/`, `components/`: UI. They reach data through hooks and context, never `db/` or `platform/`.
- `auth/`, `wallet/`, `hooks/`: React state and the hooks that call `db/` and `platform/`.
- `db/`: Supabase queries and mappers, no React.
- `platform/`: browser APIs (localStorage, file download), no React.
- `domain/`: business rules and types (transactions, record form validation).
- `utils/`: generic helpers (currency, dates), same rules as `domain/`.
- `test/`: shared test fakes.

The boundaries are enforced by ESLint (`npm run lint`, see `eslint.config.js`). `import type` is allowed everywhere, and test files are exempt.

Three ideas hold it together:

- **Pure domain layer.** Business rules take plain values and return plain values. They have no React, Supabase or browser APIs (`window`, `document` and `localStorage` are lint errors there), so they are unit-tested without React or a database.
- **Security lives in the database.** Row-level security policies decide who can read and write what. A `role_permissions` table is read by both the policies and the UI, so they cannot drift apart. The UI only hides what the database would refuse anyway.
- **Edge functions are pure handlers.** `staff-login` and `staff-admin` receive their dependencies (database calls, PIN hashing, the auth admin client) as arguments (ports and adapters). Only a thin entry file wires in the real Supabase clients, so the logic is unit-tested without Deno.

## Getting Started

Development runs against a **local Supabase stack** (Docker), never production.

Prerequisites: [Docker](https://docs.docker.com/get-docker/) running, plus `psql` (any Postgres client) if you want `db:seed`. The Supabase CLI is a pinned dev dependency, installed by `npm install`.

```bash
npm install
npm run db:start   # starts Postgres, API, Studio (http://127.0.0.1:54323) in Docker
npm run dev        # uses .env.development -> http://127.0.0.1:54321
```

| Command | What it does |
|---|---|
| `npm run db:start` / `db:stop` | Start / stop the local stack |
| `npm run db:reset` | **Destructive.** Wipes the local DB, re-applies `supabase/migrations`, loads `supabase/seed.sql` |
| `npm run db:seed` | Non-destructive: re-runs `supabase/seed.sql` (inserts are idempotent) |
| `npm test` / `npm run lint` / `npm run typecheck` | Vitest, ESLint (including the layer boundaries), `tsc -b` |
| `npm run dev:prod` | Runs the app against **production**, using `.env.prod.local` |

The seed contains fake transactions, audit entries and two local logins: the owner `owner@example.test` (password `password123`, Owner tab) and the staff member `anna` (PIN `123456`, Staff tab). After changing a migration, rebuild the local database with `npm run db:reset`.

Notes:
- `.env.development` is committed and holds the public demo values of the local stack. If `npx supabase status` prints a different key, update it there.
- Vite gives `.env.development` priority over `.env`, so `npm run dev` never uses production credentials. Move any production values out of `.env` into `.env.prod.local` (gitignored; template in `.env.example`). Variables exported in your shell (`VITE_SUPABASE_*`) override all files, so don't export production ones.
- When switching between local and production in the same browser, clear site data for `localhost:5173` (the PWA service worker caches per origin).
- If `db:start` fails: check Docker is running and ports 54321-54323 are free.

## Database migrations

The schema lives only in `supabase/migrations/` (single source of truth). To change it, add a migration (`npx supabase migration new <name>`), then test it with `npm run db:reset`.

Applying to production:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
# One time only: production already has the baseline schema, so mark it applied
npx supabase migration repair --status applied 20260101000000
npx supabase db push
```

Before pushing the auth migration (`20261008000000_auth_rls.sql`) to production, follow `supabase/backfill/README.md`: take a backup first and create the owner's account before the migration runs. Deploy the staff functions with `npx supabase functions deploy staff-login` and `npx supabase functions deploy staff-admin`.

## Build

```bash
npm run build
```

## Deploy

The app is configured for **Vercel** deployment. Connect this repo to Vercel and it will auto-deploy on every push.

## Currency

All amounts are in **EUR (€)**.
