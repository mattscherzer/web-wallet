import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const sql = (file: string) => readFileSync(join(process.cwd(), 'supabase', file), 'utf8');
const DEFAULT_WALLET = '00000000-0000-0000-0000-000000000001';
const SEED_TX = '00000000-0000-4000-8000-000000000001';

describe('soft remove migration on a real Postgres engine', () => {
  it('accepts remove and restore history, requires a reason for a removal, and keeps legacy rows', async () => {
    const file = readdirSync(join(process.cwd(), 'supabase', 'migrations')).find((f) => /soft_remove/.test(f));
    expect(file, 'a supabase/migrations/*_soft_remove.sql migration must exist').toBeDefined();

    const db = new PGlite();
    await db.exec('CREATE PUBLICATION supabase_realtime;');
    await db.exec(sql('migrations/20260101000000_initial_schema.sql'));
    await db.exec(sql('seed.sql'));
    await db.exec(sql('migrations/20261006120000_wallets.sql'));
    await db.exec(sql(`migrations/${file}`));

    const insert = (action: string, reason: string | null) =>
      db.query(
        `INSERT INTO audit_log (wallet_id, transaction_id, action, actor, reason) VALUES ($1, $2, $3, 'Anna', $4)`,
        [DEFAULT_WALLET, SEED_TX, action, reason],
      );

    await insert('remove', 'Duplicate');
    await insert('restore', null);
    await expect(insert('remove', null)).rejects.toThrow(/check|constraint|violates/i);
    await expect(insert('explode', null)).rejects.toThrow(/check|constraint|violates/i);

    // Entries removed before this change keep their old 'delete' history and stay removed.
    const legacy = (await db.query(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'delete'`)).rows[0] as { n: number };
    expect(legacy.n).toBe(1);
    const removed = (await db.query(`SELECT removed_reason, removed_by FROM transactions WHERE deleted = true`)).rows;
    expect(removed).toHaveLength(1);

    await db.close();
  });
});
