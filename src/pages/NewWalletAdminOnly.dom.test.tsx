// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { createFakeSupabase, FAKE_PROFILES, FAKE_USERS, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { WalletProvider } from '../wallet/WalletProvider';
import WalletSwitcher from '../components/WalletSwitcher';
import NewWalletPage from './NewWalletPage';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string] }),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase({ ...twoWalletRows(), profiles: FAKE_PROFILES }, { users: FAKE_USERS });
});
afterEach(cleanup);

function open(userId: string, page: 'page' | 'switcher') {
  ref.fake.signIn(userId);
  render(
    <MemoryRouter>
      <AuthProvider>
        <WalletProvider storage={{ getItem: () => null, setItem: () => {} }}>
          {page === 'page' ? <NewWalletPage /> : <WalletSwitcher onClose={() => {}} />}
        </WalletProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('creating wallets is for admins', () => {
  it('tells a normal user the new-wallet page is for admins', async () => {
    open('u-anna', 'page');
    expect(await screen.findByText(/admins only/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create wallet' })).toBeNull();
  });

  it('offers New wallet in the switcher to admins only', async () => {
    open('u-admin', 'switcher');
    expect(await screen.findByRole('button', { name: /New wallet/ })).toBeTruthy();
    cleanup();
    open('u-anna', 'switcher');
    await screen.findByText('Thursday SLAA Meeting');
    await waitFor(() => expect(screen.queryByRole('button', { name: /New wallet/ })).toBeNull());
  });
});
