# Coding standards

The rules every change to this repo follows, for people and for coding agents. Each rule says what enforces it:

| Tag      | Enforced by                                           | When it fails       |
| -------- | ----------------------------------------------------- | ------------------- |
| `lint`   | ESLint (`npm run lint`, `eslint.config.js`)           | locally and in CI   |
| `types`  | TypeScript strict mode (`npm run typecheck`)          | locally and in CI   |
| `format` | Prettier (`npm run format:check`)                     | locally and in CI   |
| `test`   | a test in `src/standards.test.ts` or next to the code | locally and in CI   |
| `CI`     | a step in `.github/workflows/ci.yml`                  | on the pull request |
| `review` | the PR checklist and the person reviewing             | at review           |

Prefer rules a machine checks. A rule tagged `review` is one nobody found a reliable check for yet; if you find one, add it and change the tag.

## 1. Architecture

Dependencies point down. A folder may import only from the layers below it.

```
app/                      composition root: App, routes, AuthGate, WalletGate
pages/  components/       UI
auth/  wallet/  hooks/    app state: providers, contexts, data and command hooks
db/  platform/            adapters: Supabase / browser APIs
domain/  utils/           pure rules and helpers
```

- **1.1** Imports follow the table above. `import type` may cross any boundary. Tests may import anything. `lint`
- **1.2** `domain/` and `utils/` are pure: no React, React Router, Supabase or lucide, and no `window`, `document` or `localStorage`. `lint`
- **1.3** `db/` and `platform/` contain no React. `lint`
- **1.4** Pages and components never import `db/` or `platform/`. They read through hooks (`useWalletQuery` and the hooks built on it) and write through command hooks (`useTransactionCommands`, `useStaffAdmin`). `lint`
- **1.5** New code goes in the lowest layer that can hold it. A rule that needs no React and no I/O goes in `domain/`, even if only one page uses it today. `review`
- **1.6** No folder outside this table (no `lib/`, `helpers/`, `services/`). Adding a layer takes a decision record (section 12). `review`

## 2. Domain: business rules

- **2.1** Functions take plain values and return plain values. They don't read the clock, storage or the network; pass `today` or `now` in. `lint` (no browser globals), `review` (clock)
- **2.2** Every domain module with runtime exports has a test file next to it. `test`
- **2.3** Money in the UI is formatted only by `formatCurrency` and `formatSignedCurrency`. Exact sums use integer cents (see `cashCount.ts`); amounts from Postgres arrive as `numeric` strings and are converted with `Number()` once, at the edge. `review`
- **2.4** Types for domain concepts (`Transaction`, `Wallet`, `Role`, `StaffMember`) live in `domain/` and are shared with `import type`. Adapters don't define their own copies. `review`

## 3. Data access (`db/`)

- **3.1** Every Supabase call checks `error` and turns it into a thrown `Error` (or a typed result). Never ignore `error`. `review`
- **3.2** Reads of one wallet's data filter by `wallet_id`. Cross-wallet reads (the wallet switcher totals) rely on row-level security, and say so in a comment. `review`
- **3.3** Every write to `transactions` writes its `audit_log` row through `recordHistory` in `db/transactions.ts`. No other code writes to `audit_log`. `review`
- **3.4** Lists that can grow past 1000 rows are read with `fetchAllRows` (the API returns at most 1000 per request). `review`
- **3.5** Only the anon key reaches the browser. The service-role key exists only in edge functions, read from the environment. `review`
- **3.6** Type assertions (`as T`) on Supabase rows happen here, at the boundary, and nowhere above it. `lint` (assertions are banned in `domain/`, `utils/` and `hooks/`)

## 4. Security

- **4.1** The database is the authority. Row-level security decides who can read and write. UI checks only hide what the database would refuse anyway. `review`
- **4.2** Every table has row-level security enabled. `test`
- **4.3** What each role may do lives in the `role_permissions` table. Policies check it through `can(wallet, action)`, and the UI through `useAuth().can(action)`. Never hard-code a role check like `kind === 'owner'` for a permission the table can express. `review`
- **4.4** Every new policy or permission gets a test that runs the real migrations on PGlite and acts as each affected role with `SET ROLE` (see `src/db/authMigrationPostgres.test.ts`). `review`
- **4.5** Authorship (`created_by`, `created_by_role`, `created_by_name`) is set by database triggers, never by the client. `review`
- **4.6** Secrets, PINs and passwords are never logged, put in URLs, or stored in localStorage. `review`

## 5. React

- **5.1** Pages are views: they compose hooks and components and hold UI state (which sheet is open, form text). Rules move to `domain/`, data access to hooks. `review`
- **5.2** Every data read shows three states: loading, failed with a way to retry, and loaded. Use the `loaded` and `failed` flags from `useWalletQuery`. `review`
- **5.3** Async work that resolves after the user moved on must not overwrite newer state. Guard it as `useWalletQuery` does (tag state with the wallet it belongs to) or with a `live` flag in the effect. `review`
- **5.4** Anything that changes data checks the view-only lock first (`requireUnlocked()`), and owner-only actions ask for confirmation (`useOwnerConfirm`). `review`
- **5.5** Errors are shown in the page (an inline message with `role="alert"`). Never `alert()`, `confirm()` or `prompt()`. `lint`
- **5.6** Interactive elements are real buttons, links or inputs with an accessible name; tests find them by role and name. `review`
- **5.7** Every `eslint-disable` comment says why after `--`. `test`

## 6. TypeScript

- **6.1** Strict mode stays on. No `any`, no `@ts-ignore` or `@ts-expect-error`. `types`, `lint`
- **6.2** No non-null assertions (`value!`). Check and throw a clear error instead. `lint`
- **6.3** Model outcomes with discriminated unions (`AccessResult`, `EntryStatus`), not booleans plus optional fields. `review`
- **6.4** Type assertions only at a boundary: Supabase rows in `db/`, DOM events and CSS custom properties in components, and tests. `lint` in `domain/`, `utils/` and `hooks/`; `review` elsewhere
- **6.5** Use `===` (`== null` is allowed for null-or-undefined), `const` by default, no `var`. `lint`

## 7. Errors and logging

- **7.1** `console.error` for failures, `console.warn` for degraded behaviour (storage blocked). No `console.log` in committed code. `lint`
- **7.2** Messages shown to people say what happened and what to do next ("Couldn't save the change. Nothing was changed."). They never show raw error text from the server. `review`
- **7.3** A failed write never leaves partial data. Undo it (as `recordHistory` does) or make it one database transaction. `review`
- **7.4** Never swallow an error. A `catch` either handles it (shows a message, retries, falls back on purpose and says why) or rethrows; an empty `catch` or one that only hides the failure is a bug. `review`

## 8. Tests

- **8.1** Run with `npx vitest run` (not watch mode). Unit tests never reach a live Supabase: use `src/test/fakeSupabase.ts` through `vi.mock`. `review`
- **8.2** SQL (policies, triggers, migrations) is tested on real Postgres with PGlite, not with mocks. `review`
- **8.3** Assert on what the user sees or what the database holds, not on which mock was called. `review`
- **8.4** Name tests by behaviour: "refuses to remove an entry without a reason", not "test removeTransaction". `review`
- **8.5** A change never weakens or deletes an assertion to make a test pass. If behaviour changes on purpose, update the assertion and say so in the PR. `review`
- **8.6** A bug fix comes with a test that fails without the fix. `review`

## 9. Style and size

- **9.1** Formatting is Prettier's (`.prettierrc`). Don't hand-format. `format`
- **9.2** Files stay under 300 lines (blank lines and comments excluded). `lint`
- **9.3** Functions stay under complexity 15, nesting depth 3 and 4 parameters. Past that, split the function or pass one object. `lint`
- **9.4** Every comment earns its keep: it says why, in one line, when the code can't. No comments that restate the code or narrate a change. `review`
- **9.5** Names come from the product's words (entry, wallet, removed, owner, staff), the same words the UI uses. `review`
- **9.6** Pages and components use a default export (pages need it for `React.lazy`). Everything else uses named exports. `review`
- **9.7** No new runtime dependency without a sentence in the PR on why the platform or an installed package can't do it. `review`
- **9.8** Delete comments that restate the code, narrate a change ("now uses X", "moved from Y") or are dead: section banners and commented-out code. Git keeps history. `test` (banners, commented-out code), `review` (the rest)
- **9.9** Doc comments carry no `@param`, `@returns` or `@type` tags; the types already say it. `test`
- **9.10** A TODO, FIXME or HACK points at an issue, as `TODO(#123)`. Without one, do it now or delete it. `test`
- **9.11** A change that makes a comment wrong fixes or deletes the comment in the same commit. `review`

## 10. Edge functions (`supabase/functions`)

- **10.1** Logic lives in `_shared/` as a pure handler, `handleX(req, deps)`, with no Deno or Supabase imports. `index.ts` only builds `deps` from real clients and calls `Deno.serve`. `review`
- **10.2** `deps` interfaces are narrow: a function receives only what it uses. `review`
- **10.3** Validate every field of the request body at the top of the handler and answer with a status code and a short message. `review`
- **10.4** Every handler path has a unit test with fake `deps`. `review`

## 11. Database migrations

- **11.1** Never edit a migration that has been applied anywhere. Fix forward with a new one. `review`
- **11.2** Migrations can run twice without harm (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DROP POLICY IF EXISTS`). `review`
- **11.3** Every new migration documents its rollback in a comment. `test` (the two oldest migrations are listed as exceptions)
- **11.4** A migration that changes existing data says in the PR that a backup is needed before it is applied to production (see `supabase/backfill/README.md`). `review`

## 12. Pull requests and decisions

- **12.1** PR titles follow Conventional Commits: `type(scope): summary`, where type is one of feat, fix, refactor, perf, test, docs, style, build, ci or chore. `CI`
- **12.2** One concern per PR. Pure moves and formatting go in their own commits. `review`
- **12.3** The PR description says what changed, any behaviour change, and how it was checked. `review`
- **12.4** Architectural decisions (a new layer, a new dependency, a rule changing here) get a short record in `docs/decisions/`: context, decision, consequences. `review`
- **12.5** The limits in 9.2 and 9.3 only go down. Raising one needs a decision record. `review`

## 13. Design principles

- **13.1** Single responsibility: a module, hook or component does one job you can name in a few words. `review`
- **13.2** Extend by adding: a new case is a new entry in a table or a new module, not another branch in an existing one. `review`
- **13.3** Composition over inheritance: build from small functions, hooks and components; no class hierarchies. `review`
- **13.4** Narrow inputs: a function takes only what it uses (see 10.2), not a whole object for one field. `review`
- **13.5** Inner layers define the shape: `domain/` owns the types, and outer layers adapt to them (see 2.4). `review`
- **13.6** Pure core, effects at the edges: rules are plain functions; network and storage stay in `db/`, `platform/` and hooks. `lint` (layers), `review`
- **13.7** No mutation of inputs or props; return new values. `lint` (`no-param-reassign` with `props`), `review`
- **13.8** Data over flags: describe variants with data (a table, a discriminated union, see 6.3), not boolean parameters that switch behaviour. `review`
- **13.9** Guard clauses: return early instead of nesting `else`. `lint` (`no-else-return`, `no-lonely-if`, `no-useless-return`, `no-unneeded-ternary`)
- **13.10** Named constants for magic numbers and strings that carry meaning (`IDLE_LOCK_MS`, `PIN_LENGTH`). `review`
- **13.11** No speculative abstraction: no option, wrapper or layer until a second real use needs it. `review`
- **13.12** Parse at the boundary: untrusted input (request bodies, Supabase rows, storage) is checked once where it enters, and trusted after (see 3.6, 10.3). `review`
- **13.13** No enums: use a union of string literals or an `as const` object. Type-only imports use `import type`. `lint` (`no-restricted-syntax`, `consistent-type-imports`)
- **13.14** Idiomatic React: derive values during render instead of syncing them with effects, keep state as small as it can be, and use object shorthand. `lint` (`object-shorthand`, react-hooks), `review`
- **13.15** Naming: names say what a thing is in the product's words (see 9.5); booleans read as questions (`loaded`, `isCurrent`). `review`
