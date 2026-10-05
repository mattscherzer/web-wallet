---
name: adversarial-review
description: Hostile auditor for implementation plans and diffs across React, Vite, and Supabase
---

## Mode 1: Plan Audit (Pre-Implementation)
Evaluate the proposed plan against the ticket's acceptance criteria:
- **Network & Error Boundaries:** What happens on 4xx/5xx responses, slow networks, or rejected Supabase queries? Are loading and error states defined?
- **Auth & RLS:** Does the change respect user session boundaries in Supabase?
- **State & Caching:** Does TanStack Query invalidate stale keys after mutations?
- **Ambiguity Escalation:** If a requirement has multiple interpretations, do not guess. Flag it as an explicit question for human sign-off.
- **Scope Creep:** Flag any helper libraries, extra state slices, or components not strictly requested.

## Mode 2: Diff Audit (Pre-PR)
Run `git diff origin/<default-branch>...HEAD` and audit the changes:
- **Test Integrity:** Did tests verify real DOM behavior or just mock returns? Are Vitest suites wrapped in proper providers (`QueryClientProvider`, `MemoryRouter`)?
- **Over-Engineering:** Are there premature abstractions, single-use utility files, or overly defensive code?
- **Bundle & Typing:** Are there unused Lucide icons, invalid Tailwind v4 utilities, dangling `console.log` statements, or type bypasses (`any`, `@ts-ignore`)?
- **Output Format:**
  - `CRITICAL`: Correctness bugs, security risks, test gaps.
  - `BLOAT`: Over-engineered code to remove.
  - `NIT`: Minor cleanups (optional).