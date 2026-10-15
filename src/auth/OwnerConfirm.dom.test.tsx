// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { AuthProvider } from './AuthProvider';
import { OWNER_CONFIRM_MS, OwnerConfirmProvider, useOwnerConfirm } from './OwnerConfirm';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string] }),
}));
// The password is checked on a separate client that never touches the app's own session.
const check = vi.hoisted(() => vi.fn(async (_email: string, password: string) => password === 'owner-pw'));
vi.mock('./passwordCheck', () => ({ checkOwnerPassword: check }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  check.mockClear();
  ref.fake = createFakeSupabase(
    { ...twoWalletRows(), profiles: FAKE_PROFILES, wallet_members: FAKE_MEMBERS, role_permissions: FAKE_PERMISSIONS },
    { users: FAKE_USERS },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function OwnerAction() {
  const confirm = useOwnerConfirm();
  const [done, setDone] = useState(0);
  return (
    <>
      <button onClick={() => void confirm().then((ok) => ok && setDone((n) => n + 1))}>Do owner thing</button>
      <p data-testid="done">{done}</p>
    </>
  );
}

function open(userId: string) {
  ref.fake.signIn(userId);
  render(
    <MemoryRouter>
      <AuthProvider>
        <OwnerConfirmProvider>
          <OwnerAction />
        </OwnerConfirmProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}
const done = () => screen.getByTestId('done').textContent;
async function enterPassword(value: string) {
  fireEvent.change(await screen.findByLabelText('Password'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
}

describe('owner password confirmation', () => {
  it('T19 an owner-only action asks for the password, stays open for 15 minutes, then asks again', async () => {
    expect(OWNER_CONFIRM_MS).toBe(15 * 60_000);
    open('u-owner');

    fireEvent.click(screen.getByRole('button', { name: 'Do owner thing' }));
    await enterPassword('wrong');
    expect((await screen.findByRole('alert')).textContent).toMatch(/password/i);
    expect(done()).toBe('0');

    await enterPassword('owner-pw');
    await waitFor(() => expect(done()).toBe('1'));
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(check).toHaveBeenLastCalledWith('olga@x.org', 'owner-pw');

    // Within 15 minutes nothing is asked again.
    vi.setSystemTime(Date.now() + 14 * 60_000);
    fireEvent.click(screen.getByRole('button', { name: 'Do owner thing' }));
    await waitFor(() => expect(done()).toBe('2'));
    expect(screen.queryByLabelText('Password')).toBeNull();

    // After 15 minutes it is.
    vi.setSystemTime(Date.now() + 16 * 60_000);
    fireEvent.click(screen.getByRole('button', { name: 'Do owner thing' }));
    expect(await screen.findByLabelText('Password')).toBeTruthy();
    expect(done()).toBe('2');
  });

  it('T19b checking the password does not touch the app session', async () => {
    open('u-owner');
    const auth = ref.fake.client.auth;
    const events: string[] = [];
    auth.onAuthStateChange((e: string) => events.push(e));
    fireEvent.click(screen.getByRole('button', { name: 'Do owner thing' }));
    await enterPassword('owner-pw');
    await waitFor(() => expect(done()).toBe('1'));
    await act(async () => {});
    expect(events).toEqual([]);
    expect(ref.fake.signOutScopes).toEqual([]);
    expect((await auth.getSession()).data.session?.user.id).toBe('u-owner');
  });

  it('T19c staff cannot confirm: the action is refused without a password prompt', async () => {
    open('u-anna');
    fireEvent.click(screen.getByRole('button', { name: 'Do owner thing' }));
    await act(async () => {});
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(done()).toBe('0');
    expect(check).not.toHaveBeenCalled();
  });
});
