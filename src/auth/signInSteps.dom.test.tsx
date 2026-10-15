// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
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
import { refused } from '../test/lockTestKit';
import { AuthProvider } from './AuthProvider';
import { AuthGate } from './AuthGate';
import { LAST_STAFF_KEY } from './LoginPage';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string] }),
}));

beforeEach(() => {
  localStorage.clear();
  ref.fake = createFakeSupabase(
    { ...twoWalletRows(), profiles: FAKE_PROFILES, wallet_members: FAKE_MEMBERS, role_permissions: FAKE_PERMISSIONS },
    { users: FAKE_USERS },
  );
  ref.fake.answerFunction('staff-login', (body) => {
    const { username, pin } = body as { username: string; pin: string };
    return username === 'anna' && pin === '123456'
      ? { data: STAFF_LOGIN_OK }
      : refused(401, { error: 'Wrong username or PIN' });
  });
});
afterEach(cleanup);

const open = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <AuthGate>
          <p>the books</p>
        </AuthGate>
      </AuthProvider>
    </MemoryRouter>,
  );
const press = (digits: string) => {
  for (const d of digits) fireEvent.click(screen.getByRole('button', { name: d }));
};
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
async function toPinStep(username = 'anna') {
  open();
  await screen.findByLabelText('Username');
  type('Username', username);
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByText(`Hi, ${username}`);
}

describe('staff sign-in in two steps', () => {
  it('T24 staff type the username once, then a 6-digit PIN pad; the right PIN signs in and the username is remembered', async () => {
    await toPinStep();
    expect(screen.getByRole('img', { name: '0 of 6 digits entered' })).toBeTruthy();
    press('123456');
    expect(await screen.findByText('the books')).toBeTruthy();
    expect(ref.fake.invocations).toEqual([{ name: 'staff-login', body: { username: 'anna', pin: '123456' } }]);
    expect(localStorage.getItem(LAST_STAFF_KEY)).toBe('anna');
  });

  it('T25 a phone that remembers the username goes straight to the PIN pad ("Hi, anna") with a way to switch person', async () => {
    localStorage.setItem(LAST_STAFF_KEY, 'anna');
    open();
    expect(await screen.findByText('Hi, anna')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Not anna\?/ }));
    expect(await screen.findByLabelText('Username')).toBeTruthy();
  });

  it('T26 while the server checks the PIN a "Checking" status shows and the pad is busy; a wrong PIN says "Wrong username or PIN"', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const original = ref.fake.client.functions.invoke;
    ref.fake.client.functions.invoke = (async (...args: Parameters<typeof original>) => {
      await gate;
      return original(...args);
    }) as typeof original;
    await toPinStep();
    press('000000');
    expect(await screen.findByRole('status', { name: /checking/i })).toBeTruthy();
    await act(async () => release());
    expect((await screen.findByRole('alert')).textContent).toBe('Wrong username or PIN');
    expect(screen.queryByText('the books')).toBeNull();
    expect(screen.getByRole('img', { name: '0 of 6 digits entered' })).toBeTruthy();
  });

  it('T27 after too many wrong tries sign-in shows a paused message and a timer from the server\'s retry time', async () => {
    ref.fake.answerFunction('staff-login', () => refused(429, { error: 'locked', retryAfter: 90 }));
    await toPinStep();
    press('000000');
    expect(await screen.findByText('Sign-in for “anna” is paused')).toBeTruthy();
    const timer = screen.getByRole('timer');
    expect(timer.textContent).toBe('1:30');
    expect(timer.getAttribute('aria-label')).toBe('Try again in 2 minutes');
    expect(screen.queryByText('the books')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use another username' }));
    expect(await screen.findByLabelText('Username')).toBeTruthy();
  });
});

describe('owner sign-in', () => {
  const toOwner = async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Owner' }));
  };

  it('T28 the owner tab asks for email and password, with a show/hide toggle for the password', async () => {
    await toOwner();
    const field = screen.getByLabelText<HTMLInputElement>('Password');
    expect(field.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(field.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Staff' }));
    expect(await screen.findByLabelText('Username')).toBeTruthy();
  });

  it('T29 a wrong owner password shows an error and stays signed out; the right one signs in', async () => {
    await toOwner();
    type('Email', 'olga@x.org');
    type('Password', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/invalid/i);
    expect(screen.queryByText('the books')).toBeNull();
    type('Password', 'owner-pw');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.queryByText('the books')).not.toBeNull());
  });
});

describe('the sign-in screens follow the design', () => {
  // the username step has the Treasury mark, a "Sign in" heading, the helper lines and the footer note
  it('T61', async () => {
    open();
    await screen.findByLabelText('Username');
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByText('Treasury')).toBeTruthy();
    expect(screen.getByText('Staff sign in with the username and 6-digit PIN the owner gave them.')).toBeTruthy();
    expect(screen.getByText('This phone remembers it, so next time you only enter your PIN.')).toBeTruthy();
    expect(screen.getByText('Forgot your PIN? Ask the owner to reset it.')).toBeTruthy();
    expect(screen.getByText(/Stays signed in on this phone until you sign out\. Locks after 30 minutes/)).toBeTruthy();
    expect(screen.getByLabelText('Username').getAttribute('aria-describedby')).toBeTruthy();
  });

  // the PIN step has a back arrow, the initial in a circle, and "Not anna? Use another username"
  it('T62', async () => {
    await toPinStep();
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('Enter your 6-digit PIN')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Not anna\? Use another username/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to username' }));
    expect(await screen.findByLabelText('Username')).toBeTruthy();
  });

  // the owner step says "Owners sign in with email and password."
  it('T63', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Owner' }));
    expect(screen.getByText('Owners sign in with email and password.')).toBeTruthy();
  });
});
