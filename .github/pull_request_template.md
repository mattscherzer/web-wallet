## What

## Why

## How it was checked

## Review checklist (rules in `docs/coding-standards.md`)

- [ ] 1.5 New code sits in the lowest layer that can hold it
- [ ] 2.3 Money is formatted by `formatCurrency` and summed in integer cents
- [ ] 3.1 Every Supabase call checks `error`; 3.3 audit rows go through `recordHistory`
- [ ] 4.1 / 4.3 Permissions rest on RLS and `role_permissions`, not UI role checks
- [ ] 5.3 Stale async results can't overwrite newer state
- [ ] 5.9 / 5.10 Sheet close handlers check which sheet is open; amounts don't wrap at 320px
- [ ] 7.2 / 7.3 Messages say what to do next; a failed write leaves no partial data
- [ ] 8.3 Tests assert what users see, not which mock was called; 8.6 the fix test fails without the fix
- [ ] 9.4 / 9.11 Every comment earns its keep (why, never what) and stays true; a new dependency says why here (9.7)
- [ ] 13 Design: one job per module, no mutation of inputs, narrow inputs, effects at the edges, no speculative abstraction
