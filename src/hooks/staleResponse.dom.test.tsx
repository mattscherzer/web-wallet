// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { walletApp } from '../test/walletTestKit';
import { useWallet } from '../wallet/useWallet';
import { useFilteredTransactionsState } from './useHistory';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy(
    {},
    {
      get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string],
    },
  ),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase(twoWalletRows());
});
afterEach(cleanup);

describe('slow answer from the previous wallet', () => {
  it('does not wipe the data of the wallet you switched to', async () => {
    // The first wallet's list is still on its way when the user switches.
    const release = ref.fake.holdNext('transactions:select');
    const { result } = renderHook(
      () => ({ wallet: useWallet(), txs: useFilteredTransactionsState('all', '').transactions }),
      {
        wrapper: ({ children }) => walletApp(children, { current: 'wa' }),
      },
    );
    await waitFor(() => expect(result.current.wallet.current?.id).toBe('wa'));

    act(() => result.current.wallet.switchWallet('wb'));
    await waitFor(() => expect(result.current.txs.map((t) => t.notes)).toEqual(['b1']));

    await act(async () => {
      release();
    });
    expect(result.current.txs.map((t) => t.notes)).toEqual(['b1']);
  });

  it('keeps the answer for the newest filter when an older request for the same wallet lands last', async () => {
    const release = ref.fake.holdNext('transactions:select');
    const { result, rerender } = renderHook(
      ({ filter }: { filter: 'all' | 'outflow' }) => ({
        wallet: useWallet(),
        txs: useFilteredTransactionsState(filter, '').transactions,
      }),
      { wrapper: ({ children }) => walletApp(children, { current: 'wa' }), initialProps: { filter: 'all' } },
    );
    await waitFor(() => expect(result.current.wallet.current?.id).toBe('wa'));
    rerender({ filter: 'outflow' });
    await waitFor(() => expect(result.current.txs.map((t) => t.notes)).toEqual(['a2']));
    await act(async () => {
      release();
    });
    expect(result.current.txs.map((t) => t.notes)).toEqual(['a2']);
  });
});
