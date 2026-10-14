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
const A = 'a0000000-0000-0000-0000-00000000000a'; // member of W1
const B = 'b0000000-0000-0000-0000-00000000000b'; // member of W2
const C = 'c0000000-0000-0000-0000-00000000000c'; // member of W1
const ADMIN = 'd0000000-0000-0000-0000-00000000000d';

const AUTH_STUB = `
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, raw_user_meta_data jsonb, created_at timestamptz NOT NULL DEFAULT now());
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
`;
// Supabase hands every table in `public` to both roles; row level security is the only gate.
const GRANTS = `
  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
  GRANT SELECT ON auth.users TO authenticated;
`;

async function baseDb() {
  const db = new PGlite();
  await db.exec('CREATE PUBLICATION supabase_realtime;');
  await db.exec(AUTH_STUB);
  for (const m of MIGRATIONS) await db.exec(read(m));
  return db;
}

async function migratedDb() {
  const db = await baseDb();
  await db.exec(read(AUTH_MIGRATION));
  await db.exec(GRANTS);
  const user = (id: string, email: string) =>
    db.query(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)`, [
      id,
      email,
      JSON.stringify({ display_name: email.split('@')[0] }),
    ]);
  await user(A, 'anna@x.org');
  await user(B, 'ben@x.org');
  await user(C, 'carl@x.org');
  await user(ADMIN, 'root@x.org');
  await db.exec(`
    UPDATE profiles SET is_admin = true WHERE id = '${ADMIN}';
    INSERT INTO wallets (id, name) VALUES ('${W1}', 'Wallet One'), ('${W2}', 'Wallet Two');
    INSERT INTO wallet_members (user_id, wallet_id) VALUES ('${A}', '${W1}'), ('${C}', '${W1}'), ('${B}', '${W2}');
    INSERT INTO transactions (id, wallet_id, type, amount, date, account_id, created_by) VALUES
      ('e0000000-0000-0000-0000-000000000001', '${W1}', 'inflow', 100, '2026-03-01', 'cash', '${A}'),
      ('e0000000-0000-0000-0000-000000000002', '${W1}', 'inflow', 50, '2026-03-02', 'cash', '${C}'),
      ('e0000000-0000-0000-0000-000000000003', '${W2}', 'inflow', 7, '2026-03-03', 'cash', '${B}');
  `);
  return db;
}

/** Run one statement as a logged-in user (or as the anon key when `user` is null). */
async function as(db: PGlite, user: string | null, text: string) {
  await db.exec(`SET ROLE ${user ? 'authenticated' : 'anon'}; SELECT set_config('request.jwt.claim.sub', '${user ?? ''}', false);`);
  try {
    return await db.query(text);
  } finally {
    await db.exec('RESET ROLE');
  }
}

const NEW_TX = (wallet: string, extra = '') =>
  `INSERT INTO transactions (wallet_id, type, amount, date, account_id${extra ? ', created_by' : ''})
   VALUES ('${wallet}', 'inflow', 5, '2026-04-01', 'bank'${extra ? `, '${extra}'` : ''})`;

describe('auth migration: wallet isolation', () => {
  it('T1 a member of one wallet sees only that wallet\'s entries and balances, and cannot write into the other', async () => {
    const db = await migratedDb();
    const mine = await as(db, A, `SELECT wallet_id, sum(amount)::text AS total FROM transactions GROUP BY wallet_id`);
    expect(mine.rows).toEqual([{ wallet_id: W1, total: '150.00' }]);
    const theirs = await as(db, B, `SELECT wallet_id, sum(amount)::text AS total FROM transactions GROUP BY wallet_id`);
    expect(theirs.rows).toEqual([{ wallet_id: W2, total: '7.00' }]);

    await expect(as(db, A, NEW_TX(W2))).rejects.toThrow(/row-level security/i);
    const changed = await as(db, A, `UPDATE transactions SET notes = 'x' WHERE wallet_id = '${W2}'`);
    expect(changed.affectedRows).toBe(0);
    const audit = await as(db, A, `SELECT count(*)::int AS n FROM audit_log WHERE wallet_id = '${W2}'`);
    expect(audit.rows).toEqual([{ n: 0 }]);
    await db.close();
  });

  it('T1b nobody can move an entry to another wallet or change who made it', async () => {
    const db = await migratedDb();
    await expect(
      as(db, A, `UPDATE transactions SET wallet_id = '${W2}' WHERE id = 'e0000000-0000-0000-0000-000000000001'`),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      as(db, A, `UPDATE transactions SET created_by = '${C}' WHERE id = 'e0000000-0000-0000-0000-000000000001'`),
    ).rejects.toThrow();
    const row = await db.query(`SELECT wallet_id, created_by FROM transactions WHERE id = 'e0000000-0000-0000-0000-000000000001'`);
    expect(row.rows).toEqual([{ wallet_id: W1, created_by: A }]);
    await db.close();
  });
});

describe('auth migration: authorship', () => {
  it('T2 two members share a wallet, each entry records its author, and an author cannot be forged', async () => {
    const db = await migratedDb();
    await as(db, A, NEW_TX(W1));
    const seenByC = await as(db, C, `SELECT created_by FROM transactions WHERE wallet_id = '${W1}' AND date = '2026-04-01'`);
    expect(seenByC.rows).toEqual([{ created_by: A }]);

    await expect(as(db, C, NEW_TX(W1, A))).rejects.toThrow(/row-level security/i);

    await as(
      db,
      C,
      `INSERT INTO audit_log (transaction_id, wallet_id, action) VALUES ('e0000000-0000-0000-0000-000000000001', '${W1}', 'update')`,
    );
    const log = await as(db, A, `SELECT created_by FROM audit_log WHERE wallet_id = '${W1}'`);
    expect(log.rows).toEqual([{ created_by: C }]);

    // A co-member's name can be shown; a stranger's cannot be read.
    const names = await as(db, A, `SELECT id, display_name FROM profiles ORDER BY display_name`);
    expect(names.rows.map((r) => (r as { id: string }).id).sort()).toEqual([A, C].sort());
    await db.close();
  });
});

describe('auth migration: admin only', () => {
  it('T3 only an admin can create wallets and memberships, and nobody can make themselves admin', async () => {
    const db = await migratedDb();
    await expect(as(db, A, `INSERT INTO wallets (name) VALUES ('Mine')`)).rejects.toThrow(/row-level security/i);
    await expect(
      as(db, A, `INSERT INTO wallet_members (user_id, wallet_id) VALUES ('${A}', '${W2}')`),
    ).rejects.toThrow(/row-level security/i);
    const promoted = await as(db, A, `UPDATE profiles SET is_admin = true WHERE id = '${A}'`);
    expect(promoted.affectedRows).toBe(0);
    expect(((await db.query(`SELECT is_admin FROM profiles WHERE id = '${A}'`)).rows[0] as { is_admin: boolean }).is_admin).toBe(false);

    await as(db, ADMIN, `INSERT INTO wallets (name) VALUES ('Made by admin')`);
    await as(db, ADMIN, `INSERT INTO wallet_members (user_id, wallet_id) VALUES ('${B}', '${W1}')`);
    const all = await as(db, ADMIN, `SELECT count(*)::int AS n FROM wallets`);
    expect((all.rows[0] as { n: number }).n).toBeGreaterThanOrEqual(4);
    // Managing is not reading: an admin who is not a member sees no entries.
    const tx = await as(db, ADMIN, `SELECT count(*)::int AS n FROM transactions`);
    expect(tx.rows).toEqual([{ n: 0 }]);
    await db.close();
  });
});

describe('auth migration: logged-out visitors', () => {
  it('T4 the anon key reads and writes nothing', async () => {
    const db = await migratedDb();
    for (const table of ['transactions', 'audit_log', 'wallets', 'wallet_members', 'profiles']) {
      const res = await as(db, null, `SELECT count(*)::int AS n FROM ${table}`);
      expect(res.rows, table).toEqual([{ n: 0 }]);
    }
    await expect(as(db, null, NEW_TX(W1))).rejects.toThrow();
    await expect(as(db, null, `SELECT * FROM app_config`)).rejects.toThrow(/does not exist/i);
    await db.close();
  });

  it('T4b the permission helpers cannot be called without logging in', async () => {
    const db = await migratedDb();
    await expect(as(db, null, `SELECT is_admin()`)).rejects.toThrow(/permission denied/i);
    await expect(as(db, null, `SELECT is_wallet_member('${W1}')`)).rejects.toThrow(/permission denied/i);
    await db.close();
  });
});

describe('auth migration: rollout of existing data', () => {
  it('T5 the owner (an account created before the update) becomes admin of the existing wallet, data stays, and it can run twice', async () => {
    const db = await baseDb();
    await db.exec(`
      INSERT INTO auth.users (id, email, created_at) VALUES
        ('${A}', 'owner@x.org', '2026-01-01'), ('${C}', 'later@x.org', '2026-02-01');
      INSERT INTO transactions (type, amount, date, account_id) VALUES
        ('inflow', 100, '2026-03-01', 'cash'), ('outflow', 30, '2026-03-02', 'cash');
    `);
    const before = (await db.query(`SELECT sum(amount)::text AS t FROM transactions`)).rows;

    await db.exec(read(AUTH_MIGRATION));
    await db.exec(read(AUTH_MIGRATION));
    await db.exec(GRANTS);

    const profiles = (await db.query(`SELECT id, is_admin FROM profiles ORDER BY id`)).rows;
    expect(profiles).toEqual([
      { id: A, is_admin: true },
      { id: C, is_admin: false },
    ]);
    const members = (await db.query(`SELECT user_id FROM wallet_members WHERE wallet_id = '${DEFAULT_WALLET}' ORDER BY user_id`)).rows;
    expect(members).toEqual([{ user_id: A }, { user_id: C }]);

    // No lockout: the owner sees every legacy entry right after the migration; legacy rows have no author.
    const seen = await as(db, A, `SELECT sum(amount)::text AS t, count(created_by)::int AS authors FROM transactions`);
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
  });
});
