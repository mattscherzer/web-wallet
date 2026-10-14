# Production rollout: auth, owner and staff, authorship (#33)

`supabase/migrations/20261008000000_auth_rls.sql` replaces the open "anyone with the anon key" access with
login and wallet membership, and drops the shared PIN. There are two roles (spec:
`docs/decisions/auth-owner-and-staff.md`):

- **Owner**: email and password. Creates wallets and manages staff.
- **Staff**: a username and a **6-digit PIN**, created by the owner. They add, edit and remove their own entries.

The migration also backfills existing data: the earliest account (the owner) becomes **owner** of the default wallet
"Thursday SLAA Meeting", and any other existing account becomes **staff** of it, **with no PIN** until the owner
sets one. Entries made before this change have no author and show "Unknown / N/A".

The old shared 4-digit PIN no longer exists. Staff PINs are new and always 6 digits: there is nothing to convert.

Develop and verify locally first, never first on production. A local database that already ran an earlier version
of this migration must be rebuilt: `npm run db:reset`.

## Order (do all of it in one sitting, so there is no window where nobody can log in)

1. **Backup first. Do not skip this.**
   ```bash
   pg_dump "$PROD_DB_URL" --no-owner --format=custom --file=backup-before-auth-$(date +%F).dump
   ```
   Keep the file somewhere safe and check it is not empty.
2. **Create the owner account** in the Supabase dashboard (Authentication → Users → Add user, email + password).
   It must exist before the migration runs: the migration makes the earliest account the owner.
   Also turn off public sign-ups (Authentication → Providers → Email → "Allow new users to sign up" off).
3. Deploy the edge functions: `npx supabase functions deploy staff-login` and `npx supabase functions deploy staff-admin`.
   (`staff-login` is called before anyone is logged in, so it runs without a JWT check: it is the only door for staff.)
4. Run the migration and ship the new app version together: `npx supabase db push`, then deploy the client.
   The old app version (PIN screen) stops working once the migration has run.
5. Log in as the owner (Owner tab), open **More → Wallets and staff**, and check that the existing entries and balances
   are unchanged. Create the staff there: a username and a 6-digit PIN each. Hand the PIN over in person.

## Good to know

- Anyone who knows a staff username can lock that person out for up to an hour by guessing PINs (5 wrong tries, then
  growing waits). The owner can reset the PIN at any time.
- Lost PIN: the owner resets it. Lost owner password: use the Supabase password reset by email. There is no other recovery.
- The owner password prompt (15 minutes) and the inactivity lock (30 minutes) are app-level; the database enforces roles.

## Rollback

If anything looks wrong, restore the backup from step 1 (`pg_restore --clean --no-owner -d "$PROD_DB_URL" <file>`)
and redeploy the previous app version. Without a restore, the manual rollback is listed at the top of the migration
file (restore the allow-all policies, re-create `app_config` with the PIN, drop the new tables, functions and
`created_by` columns).
