import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase';
import { fetchAccountBalances } from './queries';
import { fetchWalletAvailableBalances } from './wallets';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('./supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

beforeEach(() => {
  const rows = Array.from({ length: 2300 }, (_, i) => ({
    id: `t${String(i).padStart(5, '0')}`,
    wallet_id: i % 2 === 0 ? 'wa' : 'wb',
    type: 'inflow',
    amount: 1,
    account_id: 'bank',
    from_account_id: null,
    deleted: false,
  }));
  ref.fake = createFakeSupabase({ transactions: rows });
});

describe('more than 1000 entries', () => {
  it('still adds up every entry of a wallet', async () => {
    expect((await fetchAccountBalances('wa')).bank).toBe(1150);
  });

  it('still adds up every entry in the switcher balances', async () => {
    expect(await fetchWalletAvailableBalances(['wa', 'wb'])).toEqual({ wa: 1150, wb: 1150 });
  });
});
