# Auth for #33: Owner and Staff

Status: **implemented in #57** (merged to `main`). This record started as a proposal and now says what shipped, where it differs from the proposal, and what the design still has to catch up with.

## Context

The app is a group treasury wallet. It is a personal project, expected to have about 3 users, but the structure should scale without a redesign.

Before #57 there was one shared 4-digit PIN in `app_config`, publicly readable with the anon key and compared in the browser, plus "Allow all for anon" policies on every table. It protected nothing. The earlier design boards assumed passkeys, named users with roles and invite links; that was an assumption from the design, not research. The design was reworked to an owner and staff model (see "Design status"), then #57 implemented it.

## Decision

Two fixed roles, modelled on a point-of-sale system: one owner with full access, staff who record transactions.

| | Owner | Staff |
|---|---|---|
| Identity | Email and password (Supabase Auth) | Username and 6-digit PIN, created by the owner |
| Has an account | Yes, created in the Supabase dashboard | A real auth user with a random password nobody keeps, no email, no personal data |
| Belongs to | Every wallet they create | One wallet |
| Extra proof | Password again before owner-only actions | None beyond the PIN |

Names: **Owner** and **Staff** ("Manager" was rejected because it implies more power than the role has).

Precedent: Square's POS has an owner passcode and a personal passcode per staff member; a shared team passcode cannot track individuals ([Square help](https://squareup.com/help/us/en/article/8357-require-passcodes-at-point-of-sale)). One credential per person keeps history attributable.

## What shipped (verified in the code on `main`)

**Sign-in is the first screen.** `AuthGate` wraps the whole app. Until someone is signed in it shows `LoginPage` and loads no data at all. `LoginPage` is one card: a Staff / Owner switch (Staff is the default), then username and PIN, or email and password. The last staff username used on the device is remembered, so staff only type the PIN.

| Area | What shipped | Proposal it replaces |
|---|---|---|
| Lock | **Lock means signing out on this device.** After 30 minutes without use, or when the app is reopened after that, the session is cleared and the login screen shows. Also a Lock button on More. Applies to both roles. | 15 minutes |
| Owner re-confirmation | A "Confirm your password" dialog before owner-only actions, then **15 minutes** without asking again. Checked on a separate client so the session is untouched. | 5 minutes |
| PIN | **6 digits**, hashed, verified only in the `staff-login` edge function. | 4 or 6 undecided |
| PIN guessing | Per username, server-side: 5 wrong tries, then waits of 30 s doubling, up to 1 hour. Unknown usernames are counted too. The login says only "Wrong username or PIN" (and "locked" with a wait time). | 5 tries, 15 minutes |
| Staff session | `staff-login` mints a real Supabase session, so row-level security works with normal JWTs. A disabled staff member is banned at the auth level, so refresh tokens stop working. | Spike: RLS with custom claim or function-only |
| Attribution | Entries store `created_by` and an author label; history CSV includes the author. Entries from before the change show "Unknown / N/A". | Same |
| Wallet access | `wallet_members(user_id, wallet_id, role)` and `profiles(kind)`. People only see wallets they belong to. | `wallets.owner_id` |
| Staff management | **More → Wallets and staff** (`/admin`, owners only): create wallet, add staff (username, display name, 6-digit PIN, wallet), reset PIN, disable and enable. "Hand the PIN over in person." | Same, plus a one-time credential screen |
| No wallet yet | Owner: Welcome with Create a wallet. Staff: "You aren't a member of any wallet yet. Ask the owner to add you." with Sign out. | Same idea |
| Public access | Anon policies are gone. `enable_signup = false`, no anonymous sign-ins. | Same |

### Permissions (`role_permissions`, read by the app and by the database policies)

| Action | Owner | Staff |
|---|---|---|
| View | yes | yes |
| Add entry | yes | yes |
| Edit entry | yes | yes |
| Remove own entry | yes | yes |
| Remove any entry | yes | **no** |
| Restore removed entry | yes | no |
| Create category | yes | yes |
| Manage wallet | yes | no |
| Manage staff | yes | no |
| Export | yes | no |

`can(wallet, action)` is the single check; the policies call it, and the app reads the same table.

### Recovery

- Lost staff PIN: the owner resets it in Wallets and staff.
- Lost owner password: Supabase's password reset by email, from the dashboard or a Supabase-hosted page. **The app has no screen for it.**
- Anyone who knows a staff username can lock that person out for up to an hour by guessing. The owner can reset the PIN at any time.

## Differences from the proposal and the earlier design

Features the proposal and the boards assumed that did not ship:

- **No view-only link or viewer role.** Nothing is readable without signing in. There are no link, expiry or revoke controls, and no "open with a link" flow.
- **No owner sign-up screen.** Owners are created in the Supabase dashboard (`enable_signup = false`). No email confirmation flow.
- **No in-app password reset or "forgot password".**
- **Staff are disabled and enabled, not removed.**
- **No staff-detail screen**, no credentials-shown-once screen, no wallet picker for staff (one wallet each), no "Owner only" block for staff (the owner-only pages show "Owners only", and staff are not offered the links).
- The `LockPill` and `useSession` mock are still unused; nothing shows who is signed in except the line "Signed in as Name (role)" on More.

## Security requirements: status

1. PINs verified only on the server, hashed: done. The `pin` row and its public policy are removed.
2. Rate limit per username on the server: done (above).
3. 6-digit PINs: done.
4. Row-level security enforces roles: done in `20261008000000_auth_rls.sql`, with tests.
5. Staff session short-lived and scoped to one wallet: partly. Supabase access tokens last one hour with refresh rotation; the app's own 30-minute idle lock ends the session on the device. Scope to one wallet follows from membership.

## Design status

The boards in `docs/design/` were redrawn for the proposal before #57 existed. **They do not match what shipped**, and the user flow differs at the first step:

- The boards open on the dashboard in view-only mode and ask people to unlock from a bottom sheet. The app opens on a sign-in screen and has no view-only mode, so that sheet is never reached.
- The boards include flows that were not built (see the list above) and use the proposal's numbers (15 minutes, 5-minute owner window).

Redesign needed:

1. **Sign in** as the first screen, in light and dark: Staff (username remembered, PIN) and Owner (email, password), wrong PIN, locked out with a wait time, and a "Locked after 30 minutes" variant.
2. **Locked** state returning to the same screen, instead of a sheet over the dashboard.
3. **Confirm your password** dialog (15 minutes), wrong password.
4. **Wallets and staff**: wallet creation, add staff, reset PIN, disable and enable.
5. **No wallet yet** for staff.
6. Remove or park the boards for sign-up, forgot password, view-only links and staff removal, or keep them as a labelled "later" set.
7. **More**: signed-in line, Lock, Wallets and staff.

## Open decisions

- Whether to add a view-only link and viewer role later. If yes, the dashboard-first flow with an unlock sheet comes back for that role only.
- Owner sign-up and password reset inside the app, or leave them to the dashboard.
- Staff removal (today only disable).
- Can staff remove only their own entries (shipped) or any.
- Second owner per wallet, and staff in more than one wallet.
- Idle limit of 30 minutes and owner window of 15 minutes were chosen in #57 without research. NIST describes an inactivity timer and an overall timer but its numbers differ between revisions and I did not verify the current ones ([NIST SP 800-63B session](https://pages.nist.gov/800-63-4/sp800-63b/session)).

## Not researched

- Passkeys for owners (Supabase passkeys are in beta since 2026-05-28; [changelog](https://supabase.com/changelog/46458-passkeys-for-supabase-auth-beta)); whether they work in an installed home-screen app.
- User research with real treasurers: shared devices, lost phones, how groups hand over access.
- OWASP mobile guidance on local authentication.
