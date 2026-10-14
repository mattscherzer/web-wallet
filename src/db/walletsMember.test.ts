import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, FAKE_USERS, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { createWallet } from './wallets';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('./supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string] }),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase({ ...twoWalletRows(), wallet_members: [] }, { users: FAKE_USERS });
});

describe('createWallet', () => {
  it('T15 creates the wallet and its owner in one database step, so nothing is left half-made and the owner can use it right away', async () => {
    ref.fake.signIn('u-owner');
    const wallet = await createWallet('Autumn Retreat');
    expect(ref.fake.rpcCalls).toEqual([{ name: 'create_wallet', args: { name: 'Autumn Retreat' } }]);
    expect(wallet.name).toBe('Autumn Retreat');
    expect(ref.fake.tables.wallet_members).toEqual([{ user_id: 'u-owner', wallet_id: wallet.id, role: 'owner' }]);
    // No separate client-side inserts that could fail halfway.
    expect(ref.fake.queries.filter((q) => q.op === 'insert')).toEqual([]);
  });
});
