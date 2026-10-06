import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(process.cwd(), 'supabase', 'migrations');
const file = () => readdirSync(dir).find((f) => f.endsWith('_wallets.sql'));
const sql = () => readFileSync(join(dir, file() as string), 'utf8');
const at = (text: string, re: RegExp) => text.search(re);

describe('wallets migration (checked as SQL text; not run against Postgres here)', () => {
  it('exists', () => {
    expect(file()).toBeTruthy();
  });

  it('creates the default wallet once, even on an empty database', () => {
    const s = sql();
    expect(s).toMatch(/CREATE TABLE[^;]*wallets/i);
    expect(s).toMatch(/INSERT INTO wallets[^;]*Thursday SLAA Meeting[^;]*ON CONFLICT/is);
    expect(s).not.toMatch(/WHERE EXISTS/i);
  });

  it('keeps wallet names unique ignoring case', () => {
    expect(sql()).toMatch(/CREATE UNIQUE INDEX[^;]*wallets\s*\(\s*lower\(name\)\s*\)/i);
  });

  it('moves every existing row into the default wallet before wallet_id becomes required', () => {
    const s = sql();
    for (const table of ['transactions', 'audit_log']) {
      const fill = at(s, new RegExp(`UPDATE ${table}\\s+SET wallet_id\\s*=[^;]*WHERE wallet_id IS NULL`, 'i'));
      const required = at(s, new RegExp(`ALTER TABLE ${table}\\s+ALTER COLUMN wallet_id SET NOT NULL`, 'i'));
      expect(fill, `${table} backfill`).toBeGreaterThan(-1);
      expect(required, `${table} NOT NULL`).toBeGreaterThan(fill);
      expect(s).toMatch(new RegExp(`ALTER TABLE ${table}\\s+ADD COLUMN[^;]*wallet_id[^;]*REFERENCES wallets`, 'i'));
      expect(s).toMatch(new RegExp(`CREATE INDEX[^;]*ON ${table}\\s*\\(\\s*wallet_id`, 'i'));
    }
  });

  it('lets the old app version keep writing during the deploy (default wallet)', () => {
    const s = sql();
    expect(s).toMatch(/ALTER TABLE transactions\s+ALTER COLUMN wallet_id SET DEFAULT/i);
    expect(s).toMatch(/ALTER TABLE audit_log\s+ALTER COLUMN wallet_id SET DEFAULT/i);
  });

  it('documents the backup and how to roll back', () => {
    const s = sql();
    expect(s).toMatch(/backup/i);
    expect(s).toMatch(/rollback/i);
    expect(s).toMatch(/DROP COLUMN wallet_id/i);
  });

  it('protects the new table like the other tables (row level security on)', () => {
    expect(sql()).toMatch(/ALTER TABLE wallets ENABLE ROW LEVEL SECURITY/i);
    expect(sql()).toMatch(/CREATE POLICY[^;]*ON wallets/i);
  });
});
