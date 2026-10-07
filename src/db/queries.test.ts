import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { fetchAccountBalances, fetchAuditLog, fetchTransactions } from './queries';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('./supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase(twoWalletRows());
});

const notes = (rows: { notes: string }[]) => rows.map((r) => r.notes).sort();

describe('wallet-scoped queries', () => {
  it('returns only the rows of the wallet that was asked for', async () => {
    expect(notes(await fetchTransactions('wa'))).toEqual(['a1', 'a2', 'a3']);
    expect(notes(await fetchTransactions('wb'))).toEqual(['b1']);
  });

  it('returns nothing for a brand-new wallet', async () => {
    expect(await fetchTransactions('wc')).toEqual([]);
    expect(await fetchAccountBalances('wc')).toEqual({ cash: 0, paypal: 0, bank: 0, prudent_reserve: 0 });
  });

  it('shows the first wallet unchanged after looking at another one', async () => {
    const before = await fetchTransactions('wa');
    await fetchTransactions('wb');
    await fetchTransactions('wc');
    expect(await fetchTransactions('wa')).toEqual(before);
    expect(await fetchAccountBalances('wa')).toEqual({ cash: 50, paypal: 0, bank: 899.8, prudent_reserve: 0 });
  });

  it('counts only the chosen wallet in the account balances', async () => {
    expect(await fetchAccountBalances('wb')).toEqual({ cash: 7, paypal: 0, bank: 0, prudent_reserve: 0 });
  });

  it('applies type filter, limit and order on top of the wallet filter', async () => {
    const rows = await fetchTransactions('wa', { type: 'inflow', limit: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('inflow');
    const asc = await fetchTransactions('wa', { ascending: true });
    expect(asc.map((r) => r.notes)).toEqual(['a1', 'a2', 'a3']);
  });

  it('scopes the audit log to the wallet as well', async () => {
    expect((await fetchAuditLog('wa', 't1')).map((e) => e.id)).toEqual(['l1']);
    expect(await fetchAuditLog('wb', 't1')).toEqual([]);
  });

  it('reads old data through the default wallet with the same balances as before wallets existed', async () => {
    const legacy = createFakeSupabase({
      transactions: twoWalletRows().transactions.filter((t) => t.wallet_id === 'wa'),
    });
    ref.fake = legacy;
    const total = await fetchAccountBalances('wa');
    expect(total).toEqual({ cash: 50, paypal: 0, bank: 899.8, prudent_reserve: 0 });
  });
});
