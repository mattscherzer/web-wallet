# Auth for #33: Owner and Staff

Status: proposed, not implemented. Written from a design session; the product owner has agreed to the direction but not every detail (see "Open decisions").

This is a decision record plus a build plan for #33 (real auth and per-member policies). Read "What exists today" first, because it changes what you can reuse.

## Context

The app is a group treasury wallet. It is a personal project, expected to have about 3 users, but the structure should scale without a redesign.

The earlier design boards (`docs/design/source/Unlock*.dc.html`, `Members`, `MemberRole`, `InviteSheet`, `JoinWallet`) assumed passkey-first sign-in, named users with roles, and invite links. That was an assumption made from the design, not from research or from the code. This record replaces it. Those boards will be reworked; do not build from them.

## What exists today (verified in the repo)

- **No users.** The only credential is one shared 4-digit PIN stored in `app_config` (`key = 'pin'`). Seed value `1234`.
- **The PIN is public.** `supabase/migrations/20260101000000_initial_schema.sql` has `CREATE POLICY "Read only config for anon" ON app_config FOR SELECT USING (true)`. `src/components/PinModal.tsx` reads it with `usePin()` and compares in the browser. Anyone can read the PIN with the public key, so it protects nothing. Fix this first.
- **Open database.** `transactions`, `audit_log` and `wallets` all use `"Allow all for anon"` policies. `20261006120000_wallets.sql` notes per-member policies are to come with #33.
- **Mock session.** `src/session/useSession.ts` returns a hard-coded `{ name: 'Anna', minutesLeft: 42 }` and is not mounted. `src/components/LockPill.tsx` is visuals only.
- Every change currently asks for the PIN again (`PinModal`).

## Decision

Two fixed roles, modelled on a point-of-sale system (one owner with full access, staff who record transactions).

| | Owner | Staff |
|---|---|---|
| Identity | Email and password (Supabase Auth) | Username and PIN, created by the owner |
| Has an account | Yes | No (no email, no personal data) |
| Can do | Everything | Add, edit and remove entries, each with a reason |
| Extra proof | Password again for owner-only actions | None beyond the PIN |

Owner-only actions: create and edit wallets, accounts, categories (create is open to staff, archive is owner-only), staff management, restoring removed entries, exports.

A view-only link remains as a third level with no login. It is unchanged.

Names: **Owner** and **Staff**. ("Manager" was rejected because it implies more power than this role has.)

Precedent: Square's POS has an owner passcode with full access and a personal passcode per staff member, and a shared team passcode that cannot track individual activity ([Square help](https://squareup.com/help/us/en/article/8357-require-passcodes-at-point-of-sale)). One credential per person is what keeps the history attributable. I did not confirm that Square asks for the owner password on sensitive actions.

### Behaviour

- **Staff unlock once per session, not per change.** The device locks after inactivity or from the lock button. The inactivity length is open (see below).
- **Owner confirmation window.** After the owner confirms their password, owner-only actions stay open for 5 minutes, then ask again. Proposed default.
- **Staff names are typed**, with the last one remembered on that device. Listing names would expose who the staff are to whoever holds the phone. For about 3 people typing is fine.
- **Attribution.** Every entry and audit row stores who made it (role, id and a display-name snapshot), so history stays correct if a staff account is later removed. This is what the history screens promise ("signed with your name").
- **Recovery has two paths only.** The owner resets a staff PIN. The owner resets their own password by email. There is no other recovery flow.
- **Removing a staff member** disables the credential. Their device falls back to view-only.

### Permissions

Keep all rules in one place: a single `can(role, action)` table that both the app and the database policies read. Changing what staff may do is then one edit.

Proposed defaults, to be confirmed:

| Action | Owner | Staff |
|---|---|---|
| Add entry | yes | yes |
| Edit entry | yes | yes |
| Remove entry (soft, with reason) | yes | yes, own entries |
| Restore removed entry | yes | no |
| Create category | yes | yes |
| Archive or edit category | yes | no |
| Wallets, accounts | yes | no |
| Manage staff | yes | no |
| Export | yes | no |
| View | yes | yes |

## Security requirements

1. **Verify PINs on the server only.** Store a hash (bcrypt or argon2), never the PIN. Remove the `pin` row from `app_config` and the `app_config` SELECT policy once staff login lands. Do not compare PINs in the browser.
2. **Rate-limit per username on the server.** A 4-digit PIN has 10,000 values and a 6-digit one has 1,000,000, so unlimited guessing finds it in minutes ([example write-up](https://infosecwriteups.com/i-hacked-your-account-with-a-6-digit-pin-the-brute-force-nightmare-you-need-to-fix-7707309ca8c4)). Proposed: lock after about 5 consecutive failures, then escalating delays. The counter must persist across sessions and be tied to the username, not only the IP. These numbers are my recommendation, not a quoted standard.
3. **Prefer 6-digit PINs.** Four digits is acceptable only with strict lockout.
4. **Row-level security enforces roles** where feasible (see the spike). Client checks are not security.
5. Treat the staff session as short-lived and scoped to one wallet.

## How it works

- **Owner:** Supabase Auth email and password. A wallet belongs to an owner (`wallets.owner_id`).
- **Staff:** a `wallet_staff` table: `id`, `wallet_id`, `username` (unique per wallet), `pin_hash`, `disabled_at`, `failed_attempts`, `locked_until`. Only server code can read it.
- **Staff login:** an edge function `staff-login(wallet, username, pin)` checks the hash, applies the rate limit, and returns a short-lived session scoped to that wallet with a `staff_id` and `role = staff` claim.
- **Entries and audit rows** gain actor columns (role, id, name snapshot).

### Risk and fallback (needs a spike)

Managers have no Supabase account, so the database needs another way to recognise them. Supabase has [anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), but those are tied to one browser and cannot follow a PIN across devices. I found no Supabase guide for an edge function that verifies a PIN and mints a session, and I did not verify how a custom token interacts with row-level security.

Fallback if the spike fails: staff never touch the tables directly. Every staff write goes through the edge function (or an RPC), which applies `can(role, action)` and writes with the service role. For about 3 users this is acceptable and simpler. Start here if in doubt.

## Out of scope (on purpose)

More than one owner, custom permissions per person, passkeys for the owner, device lists and remote sign-out. The structure leaves room: a role column, one permissions table, and wallets tied to an owner row. Supabase passkeys exist in beta (since 2026-05-28, experimental flag, registration needs an existing session, reported registration failures, no recovery or PWA guidance) and can be added for owners later: [changelog](https://supabase.com/changelog/46458-passkeys-for-supabase-auth-beta).

## Build order

1. **Spike:** staff login function and scoped session against local Supabase (`npm run db:start`). Decide between row-level security with a custom claim and the function-only fallback.
2. **Fix the public PIN** and add owner accounts. Add `owner_id` to wallets. Replace the `"Allow all for anon"` policies with owner-based ones.
3. **Staff login, the permission table and attribution** on entries and audit rows. Replace `useSession` with the real session and wire `LockPill` to it.
4. **Remove the shared PIN** (`app_config` row, policy, `PinModal` comparison) and update the seed and README ("PIN Confirmation").
5. **Design** (done, see below): the boards exist in `docs/design/` and the design system has an `access.md` page. Build from those, not from the old passkey and invite boards.

## Design status

The screens now follow this record. Boards are in `docs/design/source` (light and dark): `Unlock`, `UnlockPin`, `UnlockChecking`, `UnlockLocked`, `OwnerSignUp`, `SignUpCheckEmail`, `OwnerSignIn`, `OwnerSignInError`, `ForgotPassword`, `ResetSent`, `ConfirmOwner`, `ConfirmOwnerWrong`, `OwnerOnly`, `People`, `StaffAdd`, `StaffAdded`, `StaffDetail`, `StaffPinReset`, `StaffRemove`, `LinkSheet`, plus the reference board `AccessModel`. The old passkey, member-role and invite boards were removed. `More`, `ChangeLog`, `Welcome`, `JoinWallet`, `JoinExpired`, `NewWallet`, `WalletSwitcher`, `DesktopWallets` and a few others had their wording changed.

The design makes some choices this record did not spell out. Confirm them or change the boards:

- **The owner also locks.** Both roles auto-lock after the inactivity period; the owner unlocks with the password. Staff session timing and owner timing are the same number (15 minutes, a proposal).
- **Owners need a sign-up.** First run is `Welcome` → create owner account (email and password, 10 characters or more) → confirm email → `NewWallet`. The confirm-email step assumes email confirmation is switched on in Supabase Auth.
- **Password reset** sends a link by email, and the confirmation message looks the same whether or not the email has an account.
- **Staff reach a wallet through the same view-only link viewers use**, then tap Unlock. There is no separate staff link. A link only ever opens the wallet view only; it carries no role.
- **View-only links** keep an expiry (1, 7 or 30 days) and can be revoked. The old use count shows as "opened by N".
- **Wallet switcher** labels are Owner, Staff or View only. Staff belong to one wallet; owners can own several. Cross-wallet staff is not designed.
- **Credentials are shown once** with Copy and Share, with advice to send the PIN in a separate message from the username. A reset ends that person's session.
- **"Staff" can remove entries and add categories but not edit or archive categories**, matching the table above. `ChangeLog` filters are People and Links instead of Members and Invites.

## Open decisions (need the product owner)

- Defaults in the permission table above, especially: can staff remove entries, and only their own?
- Length of the staff inactivity timeout and any overall session limit. No research was done here. NIST describes an inactivity timer and an overall timer but its numbers differ between revisions and I did not verify the current ones ([NIST SP 800-63B session](https://pages.nist.gov/800-63-4/sp800-63b/session)). The earlier "15 min / 1 hour / until I lock" options in the design were unresearched.
- PIN length (4 or 6).
- Owner confirmation window (5 minutes proposed).
- Whether a wallet can have a second owner, and whether staff can belong to more than one wallet.

## Not researched

- Whether passkeys work in an installed home-screen PWA (relevant only if passkeys are added later). Test on real devices.
- Any user research with real treasurers: how groups handle access, lost phones, shared devices.
- OWASP mobile guidance on local authentication.
