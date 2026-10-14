# Treasury Wallet

A mobile-first Progressive Web App for tracking treasury funds across multiple accounts.

## Features

- 💰 **Dashboard** — Total balance + per-account breakdown (Cash, PayPal, Bank)
- ➕ **Add Money** — Record inflows with date, reason, payment method, and cash calculator
- ➖ **Add Expense** — Record outflows with categories and notes
- 📜 **Transaction History** — Search, filter (All/Inflows/Outflows), and review past transactions
- 🔢 **Cash Calculator** — Count bills and coins (€0.01 to €50) to calculate totals
- 🔒 **Login & wallets** — email/password login; people only see the wallets they are members of; admins manage wallets, users and memberships
- 📝 **Audit Trail** — Full change history for every transaction
- 📱 **Offline-First PWA** — Works without internet, installable on mobile

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **IndexedDB** via Dexie.js (offline-first data storage)
- **React Router v7** (client-side routing)
- **Lucide React** (icons)
- **vite-plugin-pwa** (service worker + manifest)
- **Vanilla CSS** with custom properties

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
| `npm run dev:prod` | Runs the app against **production**, using `.env.prod.local` |

The seed contains fake transactions, audit entries and two local logins (password `password123`): `admin@example.test` (admin) and `anna@example.test` (member of the default wallet).

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

Before pushing the auth migration (`20261008000000_auth_rls.sql`) to production, follow `supabase/backfill/README.md`: take a backup first and create the owner's account before the migration runs. Deploy the user-creation function with `npx supabase functions deploy admin-create-user`.

## Build

```bash
npm run build
```

## Deploy

The app is configured for **Vercel** deployment. Connect this repo to Vercel and it will auto-deploy on every push.

## Currency

All amounts are in **EUR (€)**.
