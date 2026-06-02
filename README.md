# Treasury Wallet

A mobile-first Progressive Web App for tracking treasury funds across multiple accounts.

## Features

- 💰 **Dashboard** — Total balance + per-account breakdown (Cash, PayPal, Bank)
- ➕ **Add Money** — Record inflows with date, reason, payment method, and cash calculator
- ➖ **Add Expense** — Record outflows with categories and notes
- 📜 **Transaction History** — Search, filter (All/Inflows/Outflows), and review past transactions
- 🔢 **Cash Calculator** — Count bills and coins (€0.01 to €50) to calculate totals
- 🔒 **PIN Confirmation** — 4-digit code required for all transaction changes
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

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

The app is configured for **Vercel** deployment. Connect this repo to Vercel and it will auto-deploy on every push.

## Currency

All amounts are in **EUR (€)**.

## PIN Code

The confirmation PIN is `1234`.
