// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { memoryStorage, walletApp } from '../test/walletTestKit';
import { CURRENT_WALLET_KEY } from './walletStore';
import { useWallet } from './WalletContext';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase(twoWalletRows());
});
afterEach(cleanup);

function Probe() {
  const { current, status, switchWallet, addWallet } = useWallet();
  return (
    <>
      <p data-testid="state">{status}:{current?.name ?? 'none'}</p>
      <button onClick={() => switchWallet('wb')}>to-b</button>
      <button onClick={() => void addWallet('Autumn Retreat')}>add</button>
    </>
  );
}

describe('current wallet', () => {
  it('opens on the wallet remembered from last time, and keeps remembering it while wallets load', async () => {
    const storage = memoryStorage({ [CURRENT_WALLET_KEY]: 'wb' });
    render(walletApp(<Probe />, { storage }));
    expect(screen.getByTestId('state').textContent).toBe('loading:none');
    expect(storage.mem.get(CURRENT_WALLET_KEY)).toBe('wb');
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ready:Spring Convention 2027'));
    expect(storage.mem.get(CURRENT_WALLET_KEY)).toBe('wb');
  });

  it('keeps the chosen wallet after a reload', async () => {
    const storage = memoryStorage();
    const first = render(walletApp(<Probe />, { storage }));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ready:Thursday SLAA Meeting'));
    fireEvent.click(screen.getByText('to-b'));
    expect(screen.getByTestId('state').textContent).toBe('ready:Spring Convention 2027');
    first.unmount();

    render(walletApp(<Probe />, { storage }));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ready:Spring Convention 2027'));
  });

  it('falls back to the first wallet when the remembered one no longer exists', async () => {
    render(walletApp(<Probe />, { current: 'deleted-wallet' }));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ready:Thursday SLAA Meeting'));
  });

  it('selects a newly created wallet and lists it', async () => {
    render(walletApp(<Probe />));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toMatch(/^ready/));
    await act(async () => fireEvent.click(screen.getByText('add')));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ready:Autumn Retreat'));
  });

  it('reports an error instead of an empty list when wallets cannot be loaded', async () => {
    ref.fake.failNext('wallets:select', { message: 'offline' });
    render(walletApp(<Probe />));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('error:none'));
  });
});
