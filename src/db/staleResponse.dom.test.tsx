// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { walletApp } from '../test/walletTestKit';
import { useWallet } from '../wallet/useWallet';
import { useTransactions } from './hooks';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('./supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase(twoWalletRows());
});
afterEach(cleanup);

describe('slow answer from the previous wallet', () => {
  it('does not wipe the data of the wallet you switched to', async () => {
    // The first wallet's list is still on its way when the user switches.
    const release = ref.fake.holdNext('transactions:select');
    const { result } = renderHook(() => ({ wallet: useWallet(), txs: useTransactions() }), {
      wrapper: ({ children }) => walletApp(children, { current: 'wa' }),
    });
    await waitFor(() => expect(result.current.wallet.current?.id).toBe('wa'));

    act(() => result.current.wallet.switchWallet('wb'));
    await waitFor(() => expect(result.current.txs.map((t) => t.notes)).toEqual(['b1']));

    await act(async () => {
      release();
    });
    expect(result.current.txs.map((t) => t.notes)).toEqual(['b1']);
  });
});
