import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const sql = (file: string) => readFileSync(join(process.cwd(), 'supabase', file), 'utf8');
const BASELINE = 'migrations/20260101000000_initial_schema.sql';
const WALLETS = 'migrations/20261006120000_wallets.sql';
const DEFAULT_WALLET = '00000000-0000-0000-0000-000000000001';

async function legacyDb() {
  const db = new PGlite();
  // PGlite has no Supabase realtime publication; create it so the baseline runs unchanged.
  await db.exec('CREATE PUBLICATION supabase_realtime;');
  await db.exec(sql(BASELINE));
  await db.exec(sql('seed.sql'));
  return db;
}

const BALANCES = `SELECT account_id, sum(CASE type WHEN 'inflow' THEN amount WHEN 'outflow' THEN -amount ELSE 0 END)::text AS total
  FROM transactions WHERE deleted = false AND type <> 'transfer' %WHERE% GROUP BY account_id ORDER BY account_id`;

describe('wallets migration on a real Postgres engine', () => {
  it('moves existing data into the default wallet with identical balances, and can be run twice', async () => {
    const db = await legacyDb();
    const before = (await db.query(BALANCES.replace('%WHERE%', ''))).rows;
    const entries = Number(((await db.query('SELECT count(*) AS n FROM transactions')).rows[0] as { n: number }).n);
    expect(entries).toBeGreaterThan(0);

    await db.exec(sql(WALLETS));
    await db.exec(sql(WALLETS));

    const wallets = (await db.query('SELECT id, name FROM wallets')).rows as { id: string; name: string }[];
    expect(wallets).toEqual([{ id: DEFAULT_WALLET, name: 'Thursday SLAA Meeting' }]);

    const count = async (q: string) => Number(((await db.query(`SELECT count(*) AS n FROM ${q}`)).rows[0] as { n: number }).n);
    expect(await count('transactions')).toBe(entries);
    expect(await count(`transactions WHERE wallet_id = '${DEFAULT_WALLET}'`)).toBe(entries);
    expect(await count('audit_log WHERE wallet_id IS NULL')).toBe(0);
    expect(await count(`audit_log WHERE wallet_id <> '${DEFAULT_WALLET}'`)).toBe(0);

    const after = (await db.query(BALANCES.replace('%WHERE%', `AND wallet_id = '${DEFAULT_WALLET}'`))).rows;
    expect(after).toEqual(before);
    await db.close();
  });

  it('creates the default wallet on an empty database', async () => {
    const db = new PGlite();
    await db.exec('CREATE PUBLICATION supabase_realtime;');
    await db.exec(sql(BASELINE));
    await db.exec(sql(WALLETS));
    const rows = (await db.query('SELECT name FROM wallets')).rows;
    expect(rows).toEqual([{ name: 'Thursday SLAA Meeting' }]);
    await db.close();
  });

  it('keeps accepting entries from the old app version, and refuses a wallet name that differs only by case', async () => {
    const db = await legacyDb();
    await db.exec(sql(WALLETS));
    await db.exec("INSERT INTO transactions (type, amount, date, account_id) VALUES ('inflow', 1, '2026-02-01', 'cash')");
    const row = (await db.query('SELECT wallet_id FROM transactions ORDER BY created_at DESC LIMIT 1')).rows[0];
    expect(row).toEqual({ wallet_id: DEFAULT_WALLET });
    await expect(db.exec("INSERT INTO wallets (name) VALUES ('THURSDAY slaa meeting')")).rejects.toThrow(/duplicate|unique/i);
    await db.close();
  });
});
