import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, FAKE_USERS, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { createWallet } from './wallets';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('./supabase', () => ({
  supabase: new Proxy(
    {},
    { get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string] },
  ),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase({ ...twoWalletRows(), wallet_members: [] }, { users: FAKE_USERS });
});

describe('createWallet', () => {
  it('T15 makes the person who created the wallet a member, so they can use it right away', async () => {
    ref.fake.signIn('u-admin');
    const wallet = await createWallet('Autumn Retreat');
    const members = ref.fake.tables.wallet_members;
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ user_id: 'u-admin', wallet_id: wallet.id });
  });
});
