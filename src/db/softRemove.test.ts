import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('./supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

// Loaded dynamically so missing exports fail the assertion instead of crashing the file.
const db = await import('./database');
const queries = await import('./queries');
const api = db as unknown as {
  removeTransaction?: (id: string, o: { walletId: string; reason: string; note?: string; actor: string }) => Promise<void>;
  restoreTransaction?: (id: string, o: { walletId: string; actor: string }) => Promise<void>;
};
const fetchOne = (queries as unknown as {
  fetchTransaction?: (walletId: string, id: string) => Promise<{ id: string; deleted: boolean } | null>;
}).fetchTransaction;

const row = (id: string) => ref.fake.tables.transactions.find((r) => r.id === id)!;
const audit = (id: string) => ref.fake.tables.audit_log.filter((r) => r.transaction_id === id);

beforeEach(() => {
  ref.fake = createFakeSupabase(twoWalletRows());
});

describe('soft remove', () => {
  it('refuses to remove an entry without a reason, or twice', async () => {
    expect(api.removeTransaction, 'removeTransaction must be exported from database.ts').toBeTypeOf('function');
    const remove = api.removeTransaction!;

    await expect(remove('t1', { walletId: 'wa', reason: '', actor: 'Anna' })).rejects.toThrow(/reason/i);
    await expect(remove('t1', { walletId: 'wa', reason: 'Because', actor: 'Anna' })).rejects.toThrow(/reason/i);
    expect(row('t1').deleted).toBe(false);

    await remove('t1', { walletId: 'wa', reason: 'Duplicate', actor: 'Anna' });
    await expect(remove('t1', { walletId: 'wa', reason: 'Duplicate', actor: 'Anna' })).rejects.toThrow();
    expect(audit('t1').filter((a) => a.action === 'remove')).toHaveLength(1);

    // Another wallet's entry can't be removed by id.
    await expect(remove('t4', { walletId: 'wa', reason: 'Duplicate', actor: 'Anna' })).rejects.toThrow();
    expect(row('t4').deleted).toBe(false);

    // If the history can't be written, the entry is not left removed without a trace.
    ref.fake.failNext('audit_log:insert', { message: 'boom' });
    await expect(remove('t2', { walletId: 'wa', reason: 'Duplicate', actor: 'Anna' })).rejects.toThrow();
    expect(row('t2').deleted).toBe(false);
  });

  it('removes softly with a reason, restores, and logs both', async () => {
    expect(api.removeTransaction, 'removeTransaction must be exported from database.ts').toBeTypeOf('function');
    expect(api.restoreTransaction, 'restoreTransaction must be exported from database.ts').toBeTypeOf('function');
    expect(fetchOne, 'fetchTransaction must be exported from queries.ts').toBeTypeOf('function');

    await api.removeTransaction!('t1', { walletId: 'wa', reason: 'Wrong account', note: 'Meant PayPal', actor: 'Anna' });
    expect(row('t1')).toMatchObject({ deleted: true, removed_reason: 'Wrong account', removed_note: 'Meant PayPal', removed_by: 'Anna' });
    expect((await queries.fetchTransactions('wa')).map((t) => t.id)).not.toContain('t1');
    expect((await queries.fetchAccountBalances('wa')).bank).toBeCloseTo(-100.2);
    // A removed entry can still be opened, and only in its own wallet.
    expect(await fetchOne!('wa', 't1')).toMatchObject({ id: 't1', deleted: true });
    expect(await fetchOne!('wb', 't1')).toBeNull();

    await api.restoreTransaction!('t1', { walletId: 'wa', actor: 'Ben' });
    expect(row('t1').deleted).toBe(false);
    expect((await queries.fetchAccountBalances('wa')).bank).toBeCloseTo(899.8);

    const log = await queries.fetchAuditLog('wa', 't1');
    expect(log.map((e) => e.action)).toEqual(['create', 'remove', 'restore']);
    expect(log[1]).toMatchObject({ actor: 'Anna', reason: 'Wrong account', note: 'Meant PayPal' });
    expect(log[2]).toMatchObject({ actor: 'Ben' });
  });
});

describe('failed history writes', () => {
  it('does not restore when the removal details cannot be read', async () => {
    await api.removeTransaction!('t1', { walletId: 'wa', reason: 'Duplicate', actor: 'Anna' });
    ref.fake.failNext('transactions:select', { message: 'network blip' });
    await expect(api.restoreTransaction!('t1', { walletId: 'wa', actor: 'Ben' })).rejects.toThrow(/restore/i);
    expect(row('t1')).toMatchObject({ deleted: true, removed_reason: 'Duplicate' });
  });

  it('puts every edited field back when the history cannot be written', async () => {
    const before = { ...row('t1') };
    ref.fake.failNext('audit_log:insert', { message: 'boom' });
    await expect(
      (db as unknown as { updateTransaction: (id: string, u: object, m: object) => Promise<void> }).updateTransaction(
        't1',
        { date: '2020-01-01', amount: 1 },
        { walletId: 'wa', reason: 'Typo' }
      )
    ).rejects.toThrow();
    expect(row('t1')).toMatchObject({ date: before.date, amount: before.amount });
  });
});
