// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  createFakeSupabase,
  FAKE_MEMBERS,
  FAKE_PERMISSIONS,
  FAKE_PROFILES,
  FAKE_USERS,
  STAFF_LOGIN_OK,
  twoWalletRows,
  type FakeSupabase,
} from '../test/fakeSupabase';
import { CURRENT_WALLET_KEY } from '../wallet/walletStore';
import { AuthProvider } from './AuthProvider';
import { AuthGate } from './AuthGate';
import { LAST_STAFF_KEY } from './LoginPage';
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
  ref.fake.answerFunction('staff-login', (body) => {
    const { username, pin } = body as { username: string; pin: string };
    return username === 'anna' && pin === '123456'
      ? { data: STAFF_LOGIN_OK }
      : { error: { message: 'Wrong username or PIN' } };
  });
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

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('AuthGate', () => {
  it('T9 a visitor who is not logged in sees only the login form and no data is requested', async () => {
    app();
    expect(await screen.findByLabelText('Username')).toBeTruthy();
    expect(screen.getByLabelText('PIN')).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
    expect(screen.queryByText('secret app')).toBeNull();
    expect(ref.fake.queries).toEqual([]);
  });

  it('T10 staff sign in with a username and 6-digit PIN (and the username is remembered), owners with email and password', async () => {
    app();
    // A PIN of the wrong length is refused on the spot, without asking the server.
    await screen.findByLabelText('Username');
    type('Username', 'anna');
    type('PIN', '1234');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/6 digits/i);
    expect(ref.fake.invocations).toEqual([]);

    // A wrong PIN shows an error and keeps the app hidden.
    type('PIN', '654321');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(ref.fake.invocations).toHaveLength(1));
    expect((await screen.findByRole('alert')).textContent).toMatch(/wrong username or pin/i);
    expect(screen.queryByText('secret app')).toBeNull();

    type('PIN', '123456');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('secret app')).toBeTruthy();
    expect(ref.fake.invocations[1]).toEqual({ name: 'staff-login', body: { username: 'anna', pin: '123456' } });
    expect(localStorage.getItem(LAST_STAFF_KEY)).toBe('anna');

    // Owners use the other tab.
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Owner' }));
    type('Email', 'olga@x.org');
    type('Password', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/invalid/i);
    type('Password', 'owner-pw');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('secret app')).toBeTruthy();
  });

  it('T10b the staff form starts with the username used last on this device', async () => {
    localStorage.setItem(LAST_STAFF_KEY, 'anna');
    app();
    expect((await screen.findByLabelText<HTMLInputElement>('Username')).value).toBe('anna');
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
