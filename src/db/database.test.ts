import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase';
import { createTransaction, createTransfer, deleteTransaction, updateTransaction } from './database';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('./supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase({ transactions: [], audit_log: [] });
});

describe('writing to the chosen wallet', () => {
  it('stores a new entry and its history record under the wallet', async () => {
    await createTransaction({
      wallet_id: 'wb', type: 'inflow', amount: 12, date: '2026-04-01', account_id: 'cash',
      from_account_id: null, category: 'sales', notes: 'x', reason: null,
    });
    expect(ref.fake.tables.transactions[0].wallet_id).toBe('wb');
    expect(ref.fake.tables.audit_log[0].wallet_id).toBe('wb');
  });

  it('stores a transfer and its history record under the wallet', async () => {
    await createTransfer({ wallet_id: 'wb', amount: 5, date: '2026-04-01', from_account_id: 'bank', account_id: 'cash', notes: '' });
    expect(ref.fake.tables.transactions[0]).toMatchObject({ wallet_id: 'wb', type: 'transfer' });
    expect(ref.fake.tables.audit_log[0].wallet_id).toBe('wb');
  });

  it('keeps the history record of an edit or removal in the wallet the entry belongs to', async () => {
    ref.fake = createFakeSupabase({
      transactions: [{ id: 't1', wallet_id: 'wb', type: 'inflow', amount: 5, account_id: 'cash', deleted: false }],
      audit_log: [],
    });
    await updateTransaction('t1', { notes: 'fixed' });
    await deleteTransaction('t1');
    expect(ref.fake.tables.audit_log.map((l) => l.wallet_id)).toEqual(['wb', 'wb']);
  });
});
