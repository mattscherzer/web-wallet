// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  createFakeSupabase,
  FAKE_MEMBERS,
  FAKE_PERMISSIONS,
  FAKE_PROFILES,
  FAKE_USERS,
  twoWalletRows,
  type FakeSupabase,
} from '../test/fakeSupabase';
import { CURRENT_WALLET_KEY } from '../wallet/walletStore';
import { AuthProvider } from './AuthProvider';
import { AuthGate } from './AuthGate';
import { useAuth } from './useAuth';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string] }),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase(
    { ...twoWalletRows(), profiles: FAKE_PROFILES, wallet_members: FAKE_MEMBERS, role_permissions: FAKE_PERMISSIONS },
    { users: FAKE_USERS },
  );
  localStorage.clear();
});
afterEach(cleanup);

function SignOutButton() {
  const { signOut } = useAuth();
  return <button onClick={() => void signOut()}>Log out</button>;
}

function app() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AuthGate>
          <p>secret app</p>
          <SignOutButton />
        </AuthGate>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AuthGate', () => {
  it('T9 a visitor who is not logged in sees only the login form and no data is requested', async () => {
    app();
    expect(await screen.findByLabelText('Username')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByText('secret app')).toBeNull();
    expect(ref.fake.queries).toEqual([]);
  });

  it('T9b logging out returns to the login form and forgets the chosen wallet', async () => {
    ref.fake.signIn('u-anna');
    localStorage.setItem(CURRENT_WALLET_KEY, 'wa');
    app();
    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByLabelText('Username')).toBeTruthy();
    expect(screen.queryByText('secret app')).toBeNull();
    await waitFor(() => expect(localStorage.getItem(CURRENT_WALLET_KEY)).toBeNull());
  });
});
