# Production rollout: auth, wallets membership, authorship (#33)

`supabase/migrations/20261008000000_auth_rls.sql` replaces the open "anyone with the anon key" access with
login and wallet membership, and drops the global PIN. It also backfills existing data: every account that
exists when it runs becomes a member of the default wallet "Thursday SLAA Meeting", and the earliest account
(the owner) becomes admin. Entries made before this change have no author and show "Unknown / N/A".

Develop and verify locally first (`npm run db:reset`), never first on production.

## Order (do all of it in one sitting, so there is no window where nobody can log in)

1. **Backup first. Do not skip this.**
   ```bash
   pg_dump "$PROD_DB_URL" --no-owner --format=custom --file=backup-before-auth-$(date +%F).dump
   ```
   Keep the file somewhere safe and check it is not empty.
2. **Create the owner account** in the Supabase dashboard (Authentication → Users → Add user, email + password).
   It must exist before the migration runs: the migration makes the earliest account the admin.
   Also turn off public sign-ups (Authentication → Providers → Email → "Allow new users to sign up" off).
3. Deploy the edge function: `npx supabase functions deploy admin-create-user`.
4. Run the migration and ship the new app version together: `npx supabase db push`, then deploy the client.
   The old app version (PIN screen) stops working once the migration has run.
5. Log in as the owner, open **More → Admin**, and check that the existing entries and balances are unchanged.
   Create the other users there and give them their wallets.

## Rollback

If anything looks wrong, restore the backup from step 1 (`pg_restore --clean --no-owner -d "$PROD_DB_URL" <file>`)
and redeploy the previous app version. Without a restore, the manual rollback is listed at the top of the migration
file (restore the allow-all policies, re-create `app_config` with the PIN, drop the new tables and `created_by`
columns).
