## What

## Why

## How it was checked

## Review checklist (rules in `docs/coding-standards.md`)

- [ ] 1.5 New code sits in the lowest layer that can hold it
- [ ] 2.3 Money is formatted by `formatCurrency` and summed in integer cents
- [ ] 3.1 Every Supabase call checks `error`; 3.3 audit rows go through `recordHistory`
- [ ] 4.1 / 4.3 Permissions rest on RLS and `role_permissions`, not UI role checks
- [ ] 5.2 Data reads show loading, failed-with-retry and loaded; 5.3 stale async results can't overwrite newer state
- [ ] 5.4 Writes check the view-only lock; owner-only actions ask for confirmation
- [ ] 7.2 / 7.3 Messages say what to do next; a failed write leaves no partial data
- [ ] 8.3 / 8.5 / 8.6 Tests assert what users see, none weakened, bug fixes have a failing-first test
- [ ] 9.4 / 9.7 Comments say why only; no new dependency without a reason here
- [ ] 11.1 / 11.2 / 11.4 Migrations are new files, safe to re-run, and say if a backup is needed
