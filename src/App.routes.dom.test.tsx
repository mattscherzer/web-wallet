// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from './test/fakeSupabase';
import { memoryStorage } from './test/walletTestKit';
import { CURRENT_WALLET_KEY } from './wallet/walletStore';
import { WalletProvider } from './wallet/WalletProvider';
import { AppRoutes } from './App';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('./db/supabase', () => ({
  supabase: new Proxy(
    {},
    {
      get:
        (_t, p) =>
        (...a: unknown[]) =>
          (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a),
    },
  ),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase(twoWalletRows());
});
afterEach(cleanup);

function appAt(path: string) {
  const storage = memoryStorage({ [CURRENT_WALLET_KEY]: 'wb' });
  render(
    <MemoryRouter initialEntries={[path]}>
      <WalletProvider storage={storage}>
        <AppRoutes />
      </WalletProvider>
    </MemoryRouter>,
  );
}

describe('App routes', () => {
  it('shows the Overview page at /', async () => {
    appAt('/');
    expect(await screen.findByText('Accounts')).toBeTruthy();
  });

  it('shows the History page at /history', async () => {
    appAt('/history');
    expect(await screen.findByRole('heading', { name: 'History' })).toBeTruthy();
  });

  it.each([
    ['/add', 'Money in'],
    ['/withdraw', 'Money out'],
    ['/transfer', 'Transfer'],
  ])('sends the old address %s to the Record page with %s chosen', async (path, label) => {
    appAt(path);
    expect(await screen.findByRole('heading', { name: 'Record' })).toBeTruthy();
    expect(((await screen.findByRole('radio', { name: label })) as HTMLInputElement).checked).toBe(true);
  });

  it('draws no page and no navigation bar for an unknown address', async () => {
    appAt('/nope');
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull());
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    expect(screen.queryByText('Accounts')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'History' })).toBeNull();
  });

  it('keeps Overview unmarked on a page below the shell, so the end match holds in the real app', async () => {
    appAt('/history');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const current = Array.from(nav.querySelectorAll('[aria-current="page"]')).map((a) => a.textContent);
    expect(current).toEqual(['History']);
  });
});
