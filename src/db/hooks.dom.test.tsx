// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { walletApp } from '../test/walletTestKit';
import { useWallet } from '../wallet/useWallet';
import { useAccountBalances, useTransactions } from './hooks';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('./supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase(twoWalletRows());
});
afterEach(cleanup);

const setup = () =>
  renderHook(
    () => ({ wallet: useWallet(), txs: useTransactions(), balances: useAccountBalances() }),
    { wrapper: ({ children }) => walletApp(children, { current: 'wa' }) },
  );

describe('data follows the current wallet', () => {
  it('shows the new wallet’s data after switching, and never the old wallet’s', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.txs.map((t) => t.notes).sort()).toEqual(['a1', 'a2', 'a3']));
    expect(result.current.balances.bank).toBe(899.8);

    act(() => result.current.wallet.switchWallet('wb'));
    await waitFor(() => expect(result.current.txs.map((t) => t.notes)).toEqual(['b1']));
    expect(result.current.balances).toEqual({ cash: 7, paypal: 0, bank: 0, prudent_reserve: 0 });
  });

  it('shows the first wallet unchanged after switching back', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.txs).toHaveLength(3));
    act(() => result.current.wallet.switchWallet('wb'));
    await waitFor(() => expect(result.current.txs).toHaveLength(1));
    act(() => result.current.wallet.switchWallet('wa'));
    await waitFor(() => expect(result.current.txs.map((t) => t.notes).sort()).toEqual(['a1', 'a2', 'a3']));
  });

  it('listens for live changes of the current wallet only, and re-subscribes on a switch', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.txs).toHaveLength(3));
    const live = () => ref.fake.channels.filter((c) => !c.removed && c.table === 'transactions');
    expect(live().map((c) => c.filter)).toEqual(['wallet_id=eq.wa', 'wallet_id=eq.wa']);

    act(() => result.current.wallet.switchWallet('wb'));
    await waitFor(() => expect(live().every((c) => c.filter === 'wallet_id=eq.wb')).toBe(true));
    expect(live().length).toBeGreaterThan(0);
  });
});
