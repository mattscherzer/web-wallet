import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// Runs the real migrations on PGlite with a stand-in for Supabase's `auth` schema and roles,
// and acts as different users through `SET ROLE` so row level security is really enforced.

const read = (file: string) => readFileSync(join(process.cwd(), 'supabase', file), 'utf8');
const MIGRATIONS = [
  'migrations/20260101000000_initial_schema.sql',
  'migrations/20261006120000_wallets.sql',
  'migrations/20261007000000_soft_remove.sql',
];
const AUTH_MIGRATION = 'migrations/20261008000000_auth_rls.sql';
const DEFAULT_WALLET = '00000000-0000-0000-0000-000000000001';

const W1 = '10000000-0000-0000-0000-000000000001';
const W2 = '10000000-0000-0000-0000-000000000002';
const OWNER_A = 'a0000000-0000-0000-0000-00000000000a'; // owner of W1
const STAFF_A1 = 'a1000000-0000-0000-0000-0000000000a1'; // staff of W1
const STAFF_A2 = 'a2000000-0000-0000-0000-0000000000a2'; // staff of W1
const OWNER_B = 'b0000000-0000-0000-0000-00000000000b'; // owner of W2
const STAFF_B = 'b1000000-0000-0000-0000-0000000000b1'; // staff of W2
const E1 = 'e0000000-0000-0000-0000-000000000001'; // W1, made by STAFF_A1
const E2 = 'e0000000-0000-0000-0000-000000000002'; // W1, made by STAFF_A2
const E3 = 'e0000000-0000-0000-0000-000000000003'; // W2, made by OWNER_B

const AUTH_STUB = `
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, raw_user_meta_data jsonb, created_at timestamptz NOT NULL DEFAULT now());
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
  -- Like Supabase: everything created in schema public is handed to both roles; the migration must take back what clients must not have.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
`;
async function baseDb() {
  const db = new PGlite();
  await db.exec('CREATE PUBLICATION supabase_realtime;');
  await db.exec(AUTH_STUB);
  for (const m of MIGRATIONS) await db.exec(read(m));
  return db;
}

/** Runs the migration on a database whose tables are handed to anon/authenticated like Supabase does. */
async function applyAuthMigration(db: PGlite) {
  await db.exec(read(AUTH_MIGRATION));
}

async function migratedDb() {
  const db = await baseDb();
  await db.exec(read(AUTH_MIGRATION));
  const user = (id: string, name: string, kind: 'owner' | 'staff') =>
    db.query(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)`, [
      id,
      kind === 'staff' ? `${id}@staff.invalid` : `${name.toLowerCase()}@x.org`,
      JSON.stringify({ display_name: name, kind }),
    ]);
  await user(OWNER_A, 'Olga', 'owner');
  await user(STAFF_A1, 'Anna', 'staff');
  await user(STAFF_A2, 'Carl', 'staff');
  await user(OWNER_B, 'Ben', 'owner');
  await user(STAFF_B, 'Bea', 'staff');
  await db.exec(`
    INSERT INTO wallets (id, name) VALUES ('${W1}', 'Wallet One'), ('${W2}', 'Wallet Two');
    INSERT INTO wallet_members (user_id, wallet_id, role) VALUES
      ('${OWNER_A}', '${W1}', 'owner'), ('${STAFF_A1}', '${W1}', 'staff'), ('${STAFF_A2}', '${W1}', 'staff'),
      ('${OWNER_B}', '${W2}', 'owner'), ('${STAFF_B}', '${W2}', 'staff');
    INSERT INTO staff_credentials (user_id, wallet_id, username, pin_hash) VALUES
      ('${STAFF_A1}', '${W1}', 'anna', 'hash'), ('${STAFF_A2}', '${W1}', 'carl', 'hash'), ('${STAFF_B}', '${W2}', 'bea', 'hash');
    INSERT INTO transactions (id, wallet_id, type, amount, date, account_id, created_by) VALUES
      ('${E1}', '${W1}', 'inflow', 100, '2026-03-01', 'cash', '${STAFF_A1}'),
      ('${E2}', '${W1}', 'inflow', 50, '2026-03-02', 'cash', '${STAFF_A2}'),
      ('${E3}', '${W2}', 'inflow', 7, '2026-03-03', 'cash', '${OWNER_B}');
  `);
  return db;
}

/** Run one statement as a logged-in user (or as the anon key when `user` is null). */
async function as(db: PGlite, user: string | null, text: string) {
  await db.exec(
    `SET ROLE ${user ? 'authenticated' : 'anon'}; SELECT set_config('request.jwt.claim.sub', '${user ?? ''}', false);`,
  );
  try {
    return await db.query(text);
  } finally {
    await db.exec('RESET ROLE');
  }
}

/** True when the statement is refused: it throws, or it touches no rows. */
async function refused(db: PGlite, user: string | null, text: string) {
  try {
    const res = await as(db, user, text);
    return (res.affectedRows ?? 0) === 0 && res.rows.length === 0;
  } catch {
    return true;
  }
}

const NEW_TX = (wallet: string, extraCols = '', extraVals = '') =>
  `INSERT INTO transactions (wallet_id, type, amount, date, account_id${extraCols})
   VALUES ('${wallet}', 'inflow', 5, '2026-04-01', 'bank'${extraVals})`;
const REMOVE = (id: string) =>
  `UPDATE transactions SET deleted = true, removed_reason = 'duplicate', removed_at = now() WHERE id = '${id}'`;
const RESTORE = (id: string) =>
  `UPDATE transactions SET deleted = false, removed_reason = NULL, removed_at = NULL, removed_by = NULL WHERE id = '${id}'`;
const one = <T>(res: { rows: unknown[] }) => res.rows[0] as T;

describe('auth migration: wallet isolation', () => {
  it("T1 a member of one wallet sees only that wallet's entries and balances, and cannot write into the other", async () => {
    const db = await migratedDb();
    const mine = await as(
      db,
      STAFF_A1,
      `SELECT wallet_id, sum(amount)::text AS total FROM transactions GROUP BY wallet_id`,
    );
    expect(mine.rows).toEqual([{ wallet_id: W1, total: '150.00' }]);
    const theirs = await as(
      db,
      OWNER_B,
      `SELECT wallet_id, sum(amount)::text AS total FROM transactions GROUP BY wallet_id`,
    );
    expect(theirs.rows).toEqual([{ wallet_id: W2, total: '7.00' }]);

    await expect(as(db, STAFF_A1, NEW_TX(W2))).rejects.toThrow(/row-level security/i);
    expect(await refused(db, STAFF_A1, `UPDATE transactions SET notes = 'x' WHERE wallet_id = '${W2}'`)).toBe(true);
    expect(await refused(db, OWNER_A, `UPDATE transactions SET notes = 'x' WHERE wallet_id = '${W2}'`)).toBe(true);
    const audit = await as(db, STAFF_A1, `SELECT count(*)::int AS n FROM audit_log WHERE wallet_id = '${W2}'`);
    expect(audit.rows).toEqual([{ n: 0 }]);
    await db.close();
  });

  it('T1b nobody can move an entry to another wallet or change who made it', async () => {
    const db = await migratedDb();
    await expect(as(db, STAFF_A1, `UPDATE transactions SET wallet_id = '${W2}' WHERE id = '${E1}'`)).rejects.toThrow(
      /row-level security|cannot move/i,
    );
    await expect(
      as(db, STAFF_A1, `UPDATE transactions SET created_by = '${STAFF_A2}' WHERE id = '${E1}'`),
    ).rejects.toThrow();
    await expect(
      as(db, OWNER_A, `UPDATE transactions SET created_by_name = 'Someone' WHERE id = '${E1}'`),
    ).rejects.toThrow();
    const row = await db.query(`SELECT wallet_id, created_by FROM transactions WHERE id = '${E1}'`);
    expect(row.rows).toEqual([{ wallet_id: W1, created_by: STAFF_A1 }]);
    await db.close();
  });
});

describe('auth migration: one person in two wallets', () => {
  it('T1c an owner who belongs to two wallets still cannot move an entry from one to the other', async () => {
    const db = await migratedDb();
    await db.exec(`DROP INDEX one_owner_per_wallet`);
    await db.exec(`INSERT INTO wallet_members (user_id, wallet_id, role) VALUES ('${OWNER_B}', '${W1}', 'owner')`);
    // OWNER_B now owns W2 and W1, so both policies would allow the update; the database must still refuse.
    await expect(as(db, OWNER_B, `UPDATE transactions SET wallet_id = '${W2}' WHERE id = '${E1}'`)).rejects.toThrow();
    const row = await db.query(`SELECT wallet_id FROM transactions WHERE id = '${E1}'`);
    expect(row.rows).toEqual([{ wallet_id: W1 }]);
    await db.close();
  });
});

describe('auth migration: authorship', () => {
  it('T2 every entry and audit row records who made it (role, id, name), the client cannot forge it, and it survives removing the account', async () => {
    const db = await migratedDb();
    await as(db, STAFF_A1, NEW_TX(W1));
    const seenByOwner = await as(
      db,
      OWNER_A,
      `SELECT created_by, created_by_role, created_by_name FROM transactions WHERE wallet_id = '${W1}' AND date = '2026-04-01'`,
    );
    expect(seenByOwner.rows).toEqual([{ created_by: STAFF_A1, created_by_role: 'staff', created_by_name: 'Anna' }]);

    // Forging the author, or the stored role/name, does not work.
    await expect(as(db, STAFF_A2, NEW_TX(W1, ', created_by', `, '${STAFF_A1}'`))).rejects.toThrow(
      /row-level security/i,
    );
    await as(db, STAFF_A2, NEW_TX(W1, ', created_by_role, created_by_name', `, 'owner', 'The Boss'`));
    const forged = await as(
      db,
      OWNER_A,
      `SELECT created_by_role, created_by_name FROM transactions WHERE created_by = '${STAFF_A2}' AND date = '2026-04-01'`,
    );
    expect(forged.rows).toEqual([{ created_by_role: 'staff', created_by_name: 'Carl' }]);

    await as(
      db,
      STAFF_A2,
      `INSERT INTO audit_log (transaction_id, wallet_id, action, created_by_role, created_by_name) VALUES ('${E1}', '${W1}', 'update', 'owner', 'The Boss')`,
    );
    const log = await as(
      db,
      OWNER_A,
      `SELECT created_by, created_by_role, created_by_name FROM audit_log WHERE wallet_id = '${W1}'`,
    );
    expect(log.rows).toEqual([{ created_by: STAFF_A2, created_by_role: 'staff', created_by_name: 'Carl' }]);

    // The staff account is removed later: the history still says who made the entries.
    await db.exec(`DELETE FROM auth.users WHERE id = '${STAFF_A1}'`);
    const after = await as(
      db,
      OWNER_A,
      `SELECT created_by, created_by_role, created_by_name FROM transactions WHERE id = '${E1}'`,
    );
    expect(after.rows).toEqual([{ created_by: null, created_by_role: 'staff', created_by_name: 'Anna' }]);
    await db.close();
  });
});

describe('auth migration: roles and the permission table', () => {
  it('T3 staff add, edit and remove their own entries; only the owner restores, creates wallets and manages staff', async () => {
    const db = await migratedDb();
    // staff: allowed
    await as(db, STAFF_A1, NEW_TX(W1));
    await as(db, STAFF_A1, `UPDATE transactions SET notes = 'edited' WHERE id = '${E2}'`);
    expect(one<{ notes: string }>(await db.query(`SELECT notes FROM transactions WHERE id = '${E2}'`)).notes).toBe(
      'edited',
    );
    await as(db, STAFF_A1, REMOVE(E1));
    expect(
      one<{ deleted: boolean }>(await db.query(`SELECT deleted FROM transactions WHERE id = '${E1}'`)).deleted,
    ).toBe(true);

    // staff: refused
    expect(await refused(db, STAFF_A1, REMOVE(E2))).toBe(true);
    expect(await refused(db, STAFF_A1, RESTORE(E1))).toBe(true);
    await expect(as(db, STAFF_A1, `SELECT create_wallet('Mine')`)).rejects.toThrow();
    await expect(
      as(
        db,
        STAFF_A1,
        `INSERT INTO wallet_members (user_id, wallet_id, role) VALUES ('${STAFF_A1}', '${W2}', 'staff')`,
      ),
    ).rejects.toThrow();
    expect(
      one<{ deleted: boolean }>(await db.query(`SELECT deleted FROM transactions WHERE id = '${E2}'`)).deleted,
    ).toBe(false);

    // owner: allowed
    await as(db, OWNER_A, REMOVE(E2));
    await as(db, OWNER_A, RESTORE(E1));
    expect(
      (await db.query(`SELECT id FROM transactions WHERE id IN ('${E1}', '${E2}') AND deleted = false`)).rows.map(
        (r) => (r as { id: string }).id,
      ),
    ).toEqual([E1]);
    const made = await as(db, OWNER_A, `SELECT create_wallet('Owner made') AS id`);
    const newWallet = one<{ id: string }>(made).id;
    const membership = await db.query(`SELECT user_id, role FROM wallet_members WHERE wallet_id = '${newWallet}'`);
    expect(membership.rows).toEqual([{ user_id: OWNER_A, role: 'owner' }]);
    await db.close();
  });

  it('T3b the permission table is the single source of truth: removing a row changes what the database allows', async () => {
    const db = await migratedDb();
    await as(db, STAFF_A1, NEW_TX(W1));
    await db.exec(`DELETE FROM role_permissions WHERE role = 'staff' AND action = 'add_entry'`);
    await expect(as(db, STAFF_A1, NEW_TX(W1))).rejects.toThrow(/row-level security/i);
    await db.exec(`INSERT INTO role_permissions (role, action) VALUES ('staff', 'restore_entry')`);
    await as(db, STAFF_A1, REMOVE(E1));
    await as(db, STAFF_A1, RESTORE(E1));
    expect(
      one<{ deleted: boolean }>(await db.query(`SELECT deleted FROM transactions WHERE id = '${E1}'`)).deleted,
    ).toBe(false);
    // Everybody who is logged in can read the table (the app uses the same one) but nobody can change it.
    const rows = await as(
      db,
      STAFF_A1,
      `SELECT action FROM role_permissions WHERE role = 'owner' AND action = 'manage_staff'`,
    );
    expect(rows.rows).toHaveLength(1);
    expect(
      await refused(db, OWNER_A, `INSERT INTO role_permissions (role, action) VALUES ('staff', 'manage_staff')`),
    ).toBe(true);
    await db.close();
  });

  it('T3c nobody can rewrite profiles, memberships, permissions, wallets or the history through the public API', async () => {
    const db = await migratedDb();
    for (const user of [STAFF_A1, OWNER_A]) {
      for (const sql of [
        `UPDATE profiles SET kind = 'owner' WHERE id = '${user}'`,
        `UPDATE profiles SET display_name = 'Forged' WHERE id = '${user}'`,
        `INSERT INTO wallets (name) VALUES ('Direct')`,
        `INSERT INTO wallet_members (user_id, wallet_id, role) VALUES ('${STAFF_B}', '${W1}', 'staff')`,
        `UPDATE wallet_members SET role = 'owner' WHERE user_id = '${STAFF_A1}'`,
        `DELETE FROM wallet_members WHERE user_id = '${OWNER_A}'`,
        `UPDATE role_permissions SET action = 'x'`,
        `DELETE FROM wallets WHERE id = '${W1}'`,
        `DELETE FROM audit_log`,
        `UPDATE audit_log SET action = 'create'`,
        `UPDATE wallets SET name = 'Renamed' WHERE id = '${W2}'`,
      ]) {
        expect(await refused(db, user, sql), `${user === OWNER_A ? 'owner' : 'staff'}: ${sql}`).toBe(true);
      }
    }
    expect(one<{ kind: string }>(await db.query(`SELECT kind FROM profiles WHERE id = '${STAFF_A1}'`)).kind).toBe(
      'staff',
    );
    // A staff account can never hold an owner membership, nor an owner account a staff one.
    await expect(
      db.exec(`INSERT INTO wallet_members (user_id, wallet_id, role) VALUES ('${STAFF_B}', '${W2}', 'owner')`),
    ).rejects.toThrow();
    await expect(
      db.exec(`INSERT INTO wallet_members (user_id, wallet_id, role) VALUES ('${OWNER_A}', '${W2}', 'staff')`),
    ).rejects.toThrow();
    await db.close();
  });

  it('T3d the remove/restore rules hold column by column, and the database writes who removed an entry', async () => {
    const db = await migratedDb();
    // Staff remove their own entry: removed_by is set by the database, not by the client.
    await as(
      db,
      STAFF_A1,
      `UPDATE transactions SET deleted = true, removed_reason = 'duplicate', removed_at = now(), removed_by = 'Someone Else' WHERE id = '${E1}'`,
    );
    expect(
      one<{ removed_by: string }>(await db.query(`SELECT removed_by FROM transactions WHERE id = '${E1}'`)).removed_by,
    ).toBe('Anna');
    // Un-removing through a plain-looking edit is still a restore.
    expect(
      await refused(db, STAFF_A1, `UPDATE transactions SET removed_at = NULL, notes = 'sneaky' WHERE id = '${E1}'`),
    ).toBe(true);
    expect(await refused(db, STAFF_A1, `UPDATE transactions SET deleted = false WHERE id = '${E1}'`)).toBe(true);
    // Another staff member cannot touch removal data of someone else's removed entry.
    expect(await refused(db, STAFF_A2, `UPDATE transactions SET removed_reason = 'other' WHERE id = '${E1}'`)).toBe(
      true,
    );
    expect(
      one<{ deleted: boolean; removed_reason: string }>(
        await db.query(`SELECT deleted, removed_reason FROM transactions WHERE id = '${E1}'`),
      ),
    ).toEqual({
      deleted: true,
      removed_reason: 'duplicate',
    });
    await db.close();
  });

  it('T4d one owner per wallet and staff in one wallet are removable limits: allowing a second owner needs no schema change', async () => {
    const db = await migratedDb();
    await expect(
      db.exec(`INSERT INTO wallet_members (user_id, wallet_id, role) VALUES ('${OWNER_B}', '${W1}', 'owner')`),
    ).rejects.toThrow(/unique|duplicate/i);
    await expect(
      db.exec(`INSERT INTO wallet_members (user_id, wallet_id, role) VALUES ('${STAFF_A1}', '${W2}', 'staff')`),
    ).rejects.toThrow(/unique|duplicate/i);

    const limit = await db.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'wallet_members' AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%owner%'`,
    );
    expect(limit.rows).toHaveLength(1);
    await db.exec(`DROP INDEX ${(limit.rows[0] as { indexname: string }).indexname}`);
    await db.exec(`INSERT INTO wallet_members (user_id, wallet_id, role) VALUES ('${OWNER_B}', '${W1}', 'owner')`);
    // The second owner really has owner rights in W1 (and nothing else changed).
    await as(db, OWNER_B, REMOVE(E2));
    await as(db, OWNER_B, RESTORE(E2));
    expect(await refused(db, OWNER_B, `UPDATE transactions SET notes = 'x' WHERE id = '${E3}'`)).toBe(false);
    await db.close();
  });
});

describe('auth migration: logged-out visitors and secrets', () => {
  it('T4 the anon key reads and writes nothing', async () => {
    const db = await migratedDb();
    for (const table of ['transactions', 'audit_log', 'wallets', 'wallet_members', 'profiles']) {
      const res = await as(db, null, `SELECT count(*)::int AS n FROM ${table}`);
      expect(res.rows, table).toEqual([{ n: 0 }]);
    }
    await expect(as(db, null, `SELECT count(*) FROM role_permissions`)).rejects.toThrow();
    await expect(as(db, null, NEW_TX(W1))).rejects.toThrow();
    await expect(as(db, null, `SELECT * FROM app_config`)).rejects.toThrow(/does not exist/i);
    await db.close();
  });

  it('T4b the permission helpers cannot be called without logging in', async () => {
    const db = await migratedDb();
    await expect(as(db, null, `SELECT can('${W1}', 'view')`)).rejects.toThrow(/permission denied/i);
    await expect(as(db, null, `SELECT is_wallet_member('${W1}')`)).rejects.toThrow(/permission denied/i);
    await expect(as(db, null, `SELECT create_wallet('x')`)).rejects.toThrow(/permission denied/i);
    await db.close();
  });

  it('T4c nobody with the public key can read or change the staff PIN hashes', async () => {
    const db = await migratedDb();
    for (const user of [null, STAFF_A1, OWNER_A]) {
      await expect(as(db, user, `SELECT pin_hash FROM staff_credentials`)).rejects.toThrow(/permission denied/i);
      await expect(as(db, user, `UPDATE staff_credentials SET pin_hash = 'x'`)).rejects.toThrow(/permission denied/i);
    }
    await db.close();
  });

  it('T14c a disabled staff member loses database access immediately, even with a session that is still valid', async () => {
    const db = await migratedDb();
    expect(one<{ n: number }>(await as(db, STAFF_A1, `SELECT count(*)::int AS n FROM transactions`)).n).toBe(2);
    await db.exec(`UPDATE staff_credentials SET disabled_at = now() WHERE user_id = '${STAFF_A1}'`);
    expect(one<{ n: number }>(await as(db, STAFF_A1, `SELECT count(*)::int AS n FROM transactions`)).n).toBe(0);
    await expect(as(db, STAFF_A1, NEW_TX(W1))).rejects.toThrow(/row-level security/i);
    expect(await refused(db, STAFF_A1, `UPDATE transactions SET notes = 'x' WHERE id = '${E2}'`)).toBe(true);
    // Enabling again brings access back; the other staff member was never affected.
    await db.exec(`UPDATE staff_credentials SET disabled_at = NULL WHERE user_id = '${STAFF_A1}'`);
    expect(one<{ n: number }>(await as(db, STAFF_A1, `SELECT count(*)::int AS n FROM transactions`)).n).toBe(2);
    await db.close();
  });
});

describe('auth migration: rollout of existing data', () => {
  it('T5 the owner (an account created before the update) becomes owner of the existing wallet, others become staff, data stays, and it can run twice', async () => {
    const db = await baseDb();
    await db.exec(`
      INSERT INTO auth.users (id, email, created_at) VALUES
        ('${OWNER_A}', 'owner@x.org', '2026-01-01'), ('${STAFF_A1}', 'later@x.org', '2026-02-01');
      INSERT INTO transactions (type, amount, date, account_id) VALUES
        ('inflow', 100, '2026-03-01', 'cash'), ('outflow', 30, '2026-03-02', 'cash');
    `);
    const before = (await db.query(`SELECT sum(amount)::text AS t FROM transactions`)).rows;

    await applyAuthMigration(db);
    await applyAuthMigration(db);

    const profiles = (await db.query(`SELECT id, kind FROM profiles ORDER BY id`)).rows;
    expect(profiles).toEqual([
      { id: OWNER_A, kind: 'owner' },
      { id: STAFF_A1, kind: 'staff' },
    ]);
    const members = (
      await db.query(`SELECT user_id, role FROM wallet_members WHERE wallet_id = '${DEFAULT_WALLET}' ORDER BY user_id`)
    ).rows;
    expect(members).toEqual([
      { user_id: OWNER_A, role: 'owner' },
      { user_id: STAFF_A1, role: 'staff' },
    ]);

    // No lockout: the owner sees every legacy entry right after the migration; legacy rows have no author.
    const seen = await as(
      db,
      OWNER_A,
      `SELECT sum(amount)::text AS t, count(created_by)::int AS authors FROM transactions`,
    );
    expect(seen.rows).toEqual([{ t: (before[0] as { t: string }).t, authors: 0 }]);
    await db.close();
  });

  it('T6 the rollout notes require a backup before the production change, and explain the rollback', () => {
    const file = join(process.cwd(), 'supabase', 'backfill', 'README.md');
    expect(existsSync(file)).toBe(true);
    const text = readFileSync(file, 'utf8');
    expect(text).toMatch(/pg_dump/);
    expect(text.search(/pg_dump/)).toBeLessThan(text.search(/db push/i));
    expect(text).toMatch(/owner account/i);
    expect(text).toMatch(/rollback/i);
    expect(read(AUTH_MIGRATION)).toMatch(/rollback/i);
    // Owner/staff rollout: staff PINs are new and 6 digits, the owner sets them, and a local database must be reset.
    expect(text).toMatch(/6[- ]digit/i);
    expect(text).toMatch(/staff/i);
    expect(text).toMatch(/db:reset|db reset/i);
  });
});

describe('auth migration: staff PIN attempts (server only)', () => {
  const T0 = '2026-06-01T12:00:00Z';
  const at = (seconds: number) => new Date(Date.parse(T0) + seconds * 1000).toISOString();
  const begin = async (db: PGlite, username: string, now: string) =>
    one<{ locked: boolean; retry_after: number; user_id: string | null; disabled: boolean }>(
      await db.query(`SELECT * FROM staff_begin_attempt($1, $2::timestamptz)`, [username, now]),
    );

  it('T8 five tries are allowed, then the account locks with a longer wait each time, and a success resets it', async () => {
    const db = await migratedDb();
    for (let i = 0; i < 5; i++) expect((await begin(db, 'anna', T0)).locked, `try ${i + 1}`).toBe(false);
    const sixth = await begin(db, 'anna', at(1));
    expect(sixth.locked).toBe(true);
    expect(sixth.retry_after).toBeGreaterThan(0);

    // After the first wait one more try is allowed; failing it locks for longer than before.
    const firstWait = sixth.retry_after;
    expect((await begin(db, 'anna', at(firstWait + 5))).locked).toBe(false);
    const again = await begin(db, 'anna', at(firstWait + 6));
    expect(again.locked).toBe(true);
    expect(again.retry_after).toBeGreaterThan(firstWait);

    // The wait is capped at one hour however long somebody keeps guessing.
    let last = again.retry_after;
    for (let i = 0; i < 20; i++) {
      await begin(db, 'anna', at(100000 + i * 10000));
      last = (await begin(db, 'anna', at(100000 + i * 10000 + 1))).retry_after;
    }
    expect(last).toBeLessThanOrEqual(3600);

    // Another staff member is not affected, and a success clears the count.
    expect((await begin(db, 'carl', T0)).locked).toBe(false);
    await db.query(`SELECT staff_reset_attempts('carl')`);
    for (let i = 0; i < 5; i++) expect((await begin(db, 'carl', T0)).locked).toBe(false);
    await db.close();
  });

  it('T7b unknown names are counted and refused exactly like real ones, names are case-folded, counting is one atomic statement, and only the server may call it', async () => {
    const db = await migratedDb();
    const known = await begin(db, 'ANNA', T0);
    expect(known.user_id).toBe(STAFF_A1);
    expect(known.disabled).toBe(false);
    const unknown = await begin(db, 'nobody', T0);
    expect(unknown.user_id).toBeNull();
    for (let i = 0; i < 4; i++) await begin(db, 'nobody', T0);
    for (let i = 0; i < 4; i++) await begin(db, 'anna', T0);
    const k = await begin(db, 'Anna', at(1));
    const u = await begin(db, 'NoBody', at(1));
    expect(k.locked).toBe(true);
    expect(u.locked).toBe(true);
    expect(k.retry_after).toBe(u.retry_after);

    await db.exec(`UPDATE staff_credentials SET disabled_at = now() WHERE user_id = '${STAFF_A2}'`);
    expect((await begin(db, 'carl', T0)).disabled).toBe(true);

    // Counting must be one atomic statement (insert-or-update returning), never read-then-write, so parallel guesses all count.
    const def = one<{ def: string }>(
      await db.query(`SELECT pg_get_functiondef('staff_begin_attempt(text, timestamptz)'::regprocedure) AS def`),
    ).def;
    expect(def).toMatch(/ON CONFLICT[\s\S]*DO UPDATE[\s\S]*RETURNING/i);
    for (const user of [null, STAFF_A1, OWNER_A]) {
      await expect(as(db, user, `SELECT * FROM staff_begin_attempt('anna')`)).rejects.toThrow(/permission denied/i);
      await expect(as(db, user, `SELECT staff_reset_attempts('anna')`)).rejects.toThrow(/permission denied/i);
    }
    await db.close();
  });
});
