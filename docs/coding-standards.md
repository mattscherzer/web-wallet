# Coding standards

The rules every change to this repo follows, for people and for coding agents. Each rule says what enforces it:

| Tag      | Enforced by                                                | When it fails       |
| -------- | ---------------------------------------------------------- | ------------------- |
| `lint`   | ESLint (`npm run lint`, `eslint.config.js`)                | locally and in CI   |
| `types`  | TypeScript strict mode (`npm run typecheck`)               | locally and in CI   |
| `format` | Prettier (`npm run format:check`)                          | locally and in CI   |
| `test`   | a test in `src/standards*.test.ts` or next to the code     | locally and in CI   |
| `CI`     | `scripts/pr-checks.mjs`, run by `.github/workflows/ci.yml` | on the pull request |
| `review` | the PR checklist and the person reviewing                  | at review           |

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
- **1.6** No folder outside this table (no `test`

## 2. Domain: business rules

- **2.1** Functions take plain values and return plain values. They don't read the clock, storage or the network; pass `lint` (browser globals, clock)
- **2.2** Every domain module with runtime exports has a test file next to it. `test`
- **2.3** Money in the UI is formatted only by `review`
- **2.4** Types for domain concepts (`Transaction`, `test`
- **2.5** No date strings parsed in `domain/`: no `new Date(string)` or `Date.parse`. Compare `YYYY-MM-DD` strings or build with `Date.UTC`. `lint`
- **2.6** CSV builders in `domain/` take their cells from `csvCells.ts`; user text goes through `csvText` so spreadsheets don't run it as a formula. `test`

## 3. Data access (`db/`)

- **3.1** Every Supabase call checks `error` and turns it into a thrown `Error` (or a typed result). Never ignore `error`. `review`
- **3.2** Reads of one wallet's data filter by `wallet_id`. Cross-wallet reads (the wallet switcher totals) rely on row-level security, and say so in a comment. `review`
- **3.3** Every write to `test`
- **3.4** Lists that can grow past 1000 rows are read with `fetchAllRows` (the API returns at most 1000 per request). `review`
- **3.5** Only the anon key reaches the browser. The service-role key exists only in edge functions, read from the environment. `test`
- **3.6** Type assertions (`as T`) on Supabase rows happen here, at the boundary, and nowhere above it. `lint` (assertions are banned in `domain/`, `utils/` and `hooks/`)

## 4. Security

- **4.1** The database is the authority. Row-level security decides who can read and write. UI checks only hide what the database would refuse anyway. `review`
- **4.2** Every table has row-level security enabled. `test`
- **4.3** What each role may do lives in the `role_permissions` table. Policies check it through `can(wallet, action)`, and the UI through `useAuth().can(action)`. Never hard-code a role check like `kind === 'owner'` for a permission the table can express. `review`
- **4.4** Every new policy or permission gets a test that runs the real migrations on PGlite and acts as each affected role with `test`
- **4.5** Authorship (`created_by`, `test`
- **4.6** Secrets, PINs and passwords are never logged, put in URLs, or stored in localStorage. `test`

## 5. React

- **5.1** Pages are views: they compose hooks and components and hold UI state (which sheet is open, form text). Rules move to `domain/`, data access to hooks. `review`
- **5.2** Every data read shows three states: loading, failed with a way to retry, and loaded. Use the `test`
- **5.3** Async work that resolves after the user moved on must not overwrite newer state. Guard it as `lint` (every effect that sets state after an `await` needs a `live` flag), `review`
- **5.4** Anything that changes data checks the view-only lock first (`requireUnlocked()`), and owner-only actions ask for confirmation (`useOwnerConfirm`). `test`
- **5.5** Errors are shown in the page (an inline message with `role="alert"`). Never `alert()`, `confirm()` or `prompt()`. `lint`
- **5.6** Interactive elements are real buttons, links or inputs with an accessible name; tests find them by role and name. `lint` (clickable `div`s), `review` (names)
- **5.9** A handler that closes a sheet checks that sheet is still the open one, so a swap between sheets can't close the wrong one. `review`
- **5.10** Amounts in lists and summaries don't wrap mid-number (`white-space: nowrap`); check new screens at 320px. `review`
- **5.8** Pages and components contain no `useEffect`. An effect goes in a hook in `hooks/` named for what it does (`useCountdown`, `useMenuDismiss`). `lint`
- **5.7** Every `test`, `CI` (new disables need a "Disables added:" line in the PR)

## 6. TypeScript

- **6.1** Strict mode stays on. No `any`, no `@ts-ignore` or `@ts-expect-error`. `types`, `lint`
- **6.2** No non-null assertions (`value!`). Check and throw a clear error instead. `lint`
- **6.3** Model outcomes with discriminated unions (`AccessResult`, `EntryStatus`), not booleans plus optional fields. `review`
- **6.4** Type assertions only at a boundary: Supabase rows in `lint` in every layer except `db/` and `components/`; `review` there
- **6.5** Use `===` (`== null` is allowed for null-or-undefined), `const` by default, no `var`. `lint`

## 7. Errors and logging

- **7.1** `console.error` for failures, `console.warn` for degraded behaviour (storage blocked). No `console.log` in committed code. `lint`
- **7.2** Messages shown to people say what happened and what to do next ("Couldn't save the change. Nothing was changed."). They never show raw error text from the server. `review`
- **7.3** A failed write never leaves partial data. Undo it (as `recordHistory` does) or make it one database transaction. `review`
- **7.4** Never swallow an error. A `lint` (`.catch` that does nothing, `no-empty`), `review` (the rest)

## 8. Tests

- **8.1** Run with `test`
- **8.2** SQL (policies, triggers, migrations) is tested on real Postgres with PGlite, not with mocks. `review`
- **8.3** Assert on what the user sees or what the database holds, not on which mock was called. `review`
- **8.4** Name tests by behaviour: "refuses to remove an entry without a reason", not "test removeTransaction". `lint` (titles starting with "test"), `test` (a name that is only an id)
- **8.5** A change never weakens or deletes an assertion to make a test pass. If behaviour changes on purpose, update the assertion and say so in the PR. `CI`
- **8.6** A bug fix comes with a test that fails without the fix. `CI`

## 9. Style and size

- **9.1** Formatting is Prettier's (`.prettierrc`). Don't hand-format. `format`
- **9.2** Files stay under 300 lines (blank lines and comments excluded). `lint`
- **9.3** Functions stay under complexity 15, nesting depth 3 and 4 parameters. Past that, split the function or pass one object. `lint`
- **9.4** Delete comments by default. Keep only a legal header, behaviour forced from outside the repo (with the link or name), `prettier-ignore`, a public API contract the types can't state, or an issue link (`TODO(#123)`). A surprise in our own code is fixed by a rename, an extracted function or a tighter type. Run the `comment-sicko` agent (`.claude/agents/comment-sicko.md`) on a diff to find the rest. `test` (narration, comment blocks), `review` (the rest)
- **9.5** Names come from the product's words (entry, wallet, removed, owner, staff), the same words the UI uses. `review`
- **9.6** Pages and components use a default export (pages need it for `lint` (default exports), `test` (UI files have one)
- **9.7** No new runtime dependency without a sentence in the PR on why the platform or an installed package can't do it. `test`
- **9.8** Delete comments that restate the code, narrate a change ("now uses X", "moved from Y") or are dead: section banners and commented-out code. Git keeps history. `test` (banners, commented-out code), `review` (the rest)
- **9.9** Doc comments carry no `@param`, `@returns` or `@type` tags; the types already say it. `test`
- **9.10** A TODO, FIXME, HACK or SEE points at an issue, as `TODO(#123)` or `SEE(#123)`. Without one, do it now or delete it. `test`
- **9.11** A change that makes a comment wrong fixes or deletes the comment in the same commit. `review`

## 10. Edge functions (`supabase/functions`)

- **10.1** Logic lives in `test`
- **10.2** `deps` interfaces are narrow: a function receives only what it uses. `test`
- **10.3** Validate every field of the request body at the top of the handler and answer with a status code and a short message. `test`
- **10.4** Every handler path has a unit test with fake `test`

## 11. Database migrations

- **11.1** Never edit a migration that has been applied anywhere. Fix forward with a new one. `CI`
- **11.2** Migrations can run twice without harm (`IF NOT EXISTS`, `test`
- **11.3** Every new migration documents its rollback in a comment. `test` (the two oldest migrations are listed as exceptions)
- **11.4** A migration that changes existing data says in the PR that a backup is needed before it is applied to production (see `CI`

## 12. Pull requests and decisions

- **12.1** PR titles follow Conventional Commits: `type(scope): summary`, where type is one of feat, fix, refactor, perf, test, docs, style, build, ci or chore. `CI`
- **12.2** One concern per PR. Pure moves and formatting go in their own commits. `review`
- **12.3** The PR description says what changed, any behaviour change, and how it was checked. `CI`
- **12.4** Architectural decisions (a new layer, a new dependency, a rule changing here) get a short record in `CI`
- **12.5** The limits in 9.2 and 9.3 only go down. Raising one needs a decision record. `CI`, `test`
- **12.6** A PR that changes pages, components or styles shows the result: screenshots or a video under `## UI evidence` in the description, so a reviewer can see it without running the app. Attach with `gh pr edit <n> --attach ./shot.png`. `CI`

## 13. Design principles

- **13.1** Single responsibility: a module, hook or component does one job you can name in a few words. `review`
- **13.2** Extend by adding: a new case is a new entry in a table or a new module, not another branch in an existing one. `review`
- **13.3** Composition over inheritance: build from small functions, hooks and components; no class hierarchies. `lint` (no classes)
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

## 14. Enforcement

- **14.1** The rules' own enforcement (`eslint.config.js`, `src/standards*.test.ts`, `scripts/`, CI and the commit hook in `.claude/`) is changed only by a PR that says so with a `Standards change:` line, so a person reviews it. When a check fails, fix the code it points at: never edit the check, its exception lists, or add an `eslint-disable` to get past it. Every failure message says what to do instead. `CI`
- **14.2** `git commit` and `git push` by a coding agent are blocked until `npm run check` passes (`scripts/guard-commit.sh`). `hook`
