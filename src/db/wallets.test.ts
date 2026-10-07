import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { availableByWallet, createWallet, fetchWalletAvailableBalances, fetchWallets, MAX_WALLET_NAME } from './wallets';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('./supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase(twoWalletRows());
});

describe('createWallet', () => {
  it('saves the wallet with a trimmed name and returns it', async () => {
    const w = await createWallet('  Autumn Retreat  ');
    expect(w.name).toBe('Autumn Retreat');
    expect(ref.fake.tables.wallets.map((r) => r.name)).toContain('Autumn Retreat');
  });

  it('refuses a blank name without saving anything', async () => {
    await expect(createWallet('   ')).rejects.toThrow(/name/i);
    expect(ref.fake.tables.wallets).toHaveLength(2);
  });

  it('refuses a name that is too long', async () => {
    await expect(createWallet('x'.repeat(MAX_WALLET_NAME + 1))).rejects.toThrow(/too long/i);
    expect(ref.fake.tables.wallets).toHaveLength(2);
  });

  it('says so when the name is already taken', async () => {
    ref.fake.failNext('wallets:insert', { code: '23505', message: 'duplicate key' });
    await expect(createWallet('thursday slaa meeting')).rejects.toThrow(/already exists/i);
  });

  it('passes other failures on instead of pretending the wallet exists', async () => {
    ref.fake.failNext('wallets:insert', { message: 'boom' });
    await expect(createWallet('Anything')).rejects.toThrow(/boom/);
  });
});

describe('fetchWallets', () => {
  it('lists wallets oldest first', async () => {
    expect((await fetchWallets()).map((w) => w.id)).toEqual(['wa', 'wb']);
  });

  it('fails loudly when the request fails', async () => {
    ref.fake.failNext('wallets:select', { message: 'offline' });
    await expect(fetchWallets()).rejects.toThrow(/offline/);
  });
});

describe('availableByWallet', () => {
  it('adds up available money per wallet, leaves the reserve out, and lists empty wallets as 0', () => {
    const rows = [
      ...twoWalletRows().transactions,
      { wallet_id: 'wa', type: 'inflow', amount: 500, account_id: 'prudent_reserve', from_account_id: null },
    ] as never[];
    expect(availableByWallet(['wa', 'wb', 'wc'], rows)).toEqual({ wa: 949.8, wb: 7, wc: 0 });
  });
});

describe('fetchWalletAvailableBalances', () => {
  it('asks the database once for all wallets, and gives empty wallets 0', async () => {
    const before = ref.fake.queries.length;
    expect(await fetchWalletAvailableBalances(['wa', 'wb', 'wc'])).toEqual({ wa: 949.8, wb: 7, wc: 0 });
    expect(ref.fake.queries.length - before).toBe(1);
  });
});
