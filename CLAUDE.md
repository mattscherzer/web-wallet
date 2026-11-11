# web-wallet

Read `docs/coding-standards.md` before changing code. Every rule there says what enforces it.

## Layers (dependencies point down; `import type` may cross)

- `app/`: composition root (App, routes, gates)
- `pages/`, `components/`: UI; read through hooks, never import `db/` or `platform/`
- `auth/`, `wallet/`, `hooks/`: app state, contexts, data and command hooks
- `db/`, `platform/`: Supabase and browser adapters, no React
- `domain/`, `utils/`: pure rules and helpers, no React, Supabase or browser globals

## Before calling work done

```
npm run lint
npm run typecheck
npm run format:check
npx vitest run
npm run build
```

Never run `vitest` or `npm test` in watch mode.

## Never

- Weaken or delete an assertion to make a test pass. If behaviour changes on purpose, update it and say so.
- Edit a migration that has been applied. Fix forward with a new one.
- Add a comment that restates the code. Comment only the why, in one line.
- Raise a lint limit or add an `eslint-disable` without `-- reason`.

## Pull requests

Titles follow Conventional Commits (`type(scope): summary`). Fill in `.github/pull_request_template.md`.
