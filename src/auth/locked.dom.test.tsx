// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  createFakeSupabase,
  FAKE_MEMBERS,
  FAKE_PERMISSIONS,
  FAKE_PROFILES,
  FAKE_USERS,
  twoWalletRows,
  type FakeSupabase,
} from '../test/fakeSupabase';
import { findSheet, noSheet, pass, pressPin, refused, rememberStaff, shell, sheet } from '../test/lockTestKit';
import { LAST_STAFF_KEY } from './staffLogin';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string] }),
}));
const check = vi.hoisted(() => vi.fn(async (_email: string, password: string) => password === 'owner-pw'));
vi.mock('./passwordCheck', () => ({ checkOwnerPassword: check }));

beforeEach(() => {
  localStorage.clear();
  check.mockReset();
  check.mockImplementation(async (_e: string, p: string) => p === 'owner-pw');
  ref.fake = createFakeSupabase(
    { ...twoWalletRows(), profiles: FAKE_PROFILES, wallet_members: FAKE_MEMBERS, role_permissions: FAKE_PERMISSIONS },
    { users: FAKE_USERS },
  );
  ref.fake.answerFunction('staff-login', (body) => {
    const { username, pin } = body as { username: string; pin: string };
    return username === 'anna' && pin === '123456'
      ? { data: { userId: 'u-anna' } }
      : refused(401, { error: 'Wrong username or PIN' });
  });
});
afterEach(cleanup);

/** Open as staff anna, lock with the header lock, then tap the closed lock to get the Unlock sheet. */
async function lockedAsStaff() {
  rememberStaff();
  ref.fake.signIn('u-anna');
  shell();
  fireEvent.click(await screen.findByRole('button', { name: 'Lock' }));
  fireEvent.click(await screen.findByRole('button', { name: /Locked, view only/ }));
  await findSheet();
}
const staffLoginCalls = () => ref.fake.invocations.filter((i) => i.name === 'staff-login');

describe('unlocking as staff', () => {
  it('T8 the right PIN unlocks: staff-login is asked with the remembered username, and the lock opens', async () => {
    await lockedAsStaff();
    expect(within(sheet()).getByText(/Hi, anna/)).toBeTruthy();
    pressPin('123456');
    await waitFor(() => expect(noSheet()).toBeNull());
    expect(staffLoginCalls()).toEqual([
      { name: 'staff-login', body: { username: 'anna', pin: '123456', verifyOnly: true } },
    ]);
    expect(screen.getByRole('button', { name: 'Lock' })).toBeTruthy();
    expect(ref.fake.signOutScopes).toEqual([]);
  });

  it('T9 a wrong PIN says "Wrong PIN", clears the dots and stays locked', async () => {
    await lockedAsStaff();
    pressPin('000000');
    expect(await within(sheet()).findByText('Wrong PIN')).toBeTruthy();
    expect(within(sheet()).getByRole('img', { name: '0 of 6 digits entered' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Locked, view only/ })).toBeTruthy();
  });

  it('T10 PIN digits show as filled dots and the delete key removes the last one', async () => {
    await lockedAsStaff();
    pressPin('123');
    expect(within(sheet()).getByRole('img', { name: '3 of 6 digits entered' })).toBeTruthy();
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Delete last digit' }));
    expect(within(sheet()).getByRole('img', { name: '2 of 6 digits entered' })).toBeTruthy();
    expect(staffLoginCalls()).toEqual([]);
  });

  it('T11 after too many wrong tries the sheet shows "Unlock for “anna” is paused" with a counting timer', async () => {
    ref.fake.answerFunction('staff-login', () => refused(429, { error: 'locked', retryAfter: 120 }));
    await lockedAsStaff();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    try {
      pressPin('000000');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(within(sheet()).getByText('Unlock for “anna” is paused')).toBeTruthy();
      const timer = within(sheet()).getByRole('timer');
      expect(timer.getAttribute('aria-label')).toBe('Try again in 2 minutes');
      expect(timer.textContent).toBe('2:00');
      await pass(30_000);
      expect(within(sheet()).getByRole('timer').textContent).toBe('1:30');
      fireEvent.click(within(sheet()).getByRole('button', { name: 'Back to viewing' }));
      expect(noSheet()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('T12 a network failure says it could not check, not "Wrong PIN"', async () => {
    ref.fake.answerFunction('staff-login', () => ({ error: { message: 'Failed to fetch' } }));
    await lockedAsStaff();
    pressPin('123456');
    expect(await within(sheet()).findByText(/Couldn’t check/)).toBeTruthy();
    expect(within(sheet()).queryByText('Wrong PIN')).toBeNull();
    expect(screen.getByRole('button', { name: /Locked, view only/ })).toBeTruthy();
  });

  it('T13 a PIN that belongs to someone else is not accepted for the signed-in person', async () => {
    ref.fake.answerFunction('staff-login', () => ({ data: { userId: 'u-owner' } }));
    await lockedAsStaff();
    pressPin('123456');
    expect(await within(sheet()).findByText('Wrong PIN')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Locked, view only/ })).toBeTruthy();
  });

  it('T14 "Not anna? Sign out" in the sheet ends the session; Close keeps viewing', async () => {
    await lockedAsStaff();
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Close, keep viewing' }));
    expect(noSheet()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Locked, view only/ }));
    fireEvent.click(within(await findSheet()).getByRole('button', { name: /Sign out/ }));
    await waitFor(() => expect(ref.fake.signOutScopes).toEqual(['local']));
    expect(await screen.findByLabelText('Username')).toBeTruthy();
  });
});

describe('unlocking as owner', () => {
  async function lockedAsOwner() {
    ref.fake.signIn('u-owner');
    shell();
    fireEvent.click(await screen.findByRole('button', { name: 'Lock' }));
    fireEvent.click(await screen.findByRole('button', { name: /Locked, view only/ }));
    await findSheet();
  }

  it('T15 the owner types the password: a wrong one is refused, the right one unlocks', async () => {
    await lockedAsOwner();
    expect(within(sheet()).getByText(/Hi, Olga\. Enter your password/)).toBeTruthy();
    expect(within(sheet()).getByText('Locks again after 30 minutes without use.')).toBeTruthy();
    fireEvent.change(within(sheet()).getByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Unlock' }));
    expect(await within(sheet()).findByText('Wrong password')).toBeTruthy();
    fireEvent.change(within(sheet()).getByLabelText('Password'), { target: { value: 'owner-pw' } });
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(noSheet()).toBeNull());
    expect(check).toHaveBeenLastCalledWith('olga@x.org', 'owner-pw');
    expect(screen.getByRole('button', { name: 'Lock' })).toBeTruthy();
  });

  it('T16 a failing password check (network) says it could not check, not "Wrong password"', async () => {
    check.mockRejectedValue(new Error('network'));
    await lockedAsOwner();
    fireEvent.change(within(sheet()).getByLabelText('Password'), { target: { value: 'owner-pw' } });
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Unlock' }));
    expect(await within(sheet()).findByText(/Couldn’t check/)).toBeTruthy();
    expect(within(sheet()).queryByText('Wrong password')).toBeNull();
  });

  it('T17 locking forgets the 15-minute owner confirmation: the next owner action asks for the password again', async () => {
    ref.fake.signIn('u-owner');
    ref.fake.answerFunction('staff-admin', () => ({ data: { staff: [] } }));
    shell(null, '/admin');
    fireEvent.change(await screen.findByLabelText('Wallet name'), { target: { value: 'One' } });
    fireEvent.click(screen.getByRole('button', { name: /create wallet/i }));
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'owner-pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(ref.fake.rpcCalls).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    fireEvent.click(await screen.findByRole('button', { name: /Locked, view only/ }));
    fireEvent.change(within(await findSheet()).getByLabelText('Password'), { target: { value: 'owner-pw' } });
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(noSheet()).toBeNull());

    fireEvent.change(screen.getByLabelText('Wallet name'), { target: { value: 'Two' } });
    fireEvent.click(screen.getByRole('button', { name: /create wallet/i }));
    expect(await screen.findByRole('dialog', { name: 'Confirm your password' })).toBeTruthy();
    expect(ref.fake.rpcCalls).toHaveLength(1);
  });
});

describe('the idle lock banner', () => {
  it('T18 after an idle lock a bar says "Locked after 30 minutes without use" with Unlock; a manual lock shows no bar', async () => {
    vi.useFakeTimers();
    try {
      rememberStaff();
      ref.fake.signIn('u-anna');
      shell();
      await pass(100);
      fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
      await pass(10);
      expect(screen.queryByText('Locked after 30 minutes without use')).toBeNull();
      cleanup();

      localStorage.clear();
      rememberStaff();
      ref.fake.signIn('u-anna');
      shell();
      await pass(100);
      await pass(31 * 60_000);
      const bar = screen.getByText('Locked after 30 minutes without use').closest('[role="status"]') as HTMLElement;
      expect(bar).toBeTruthy();
      fireEvent.click(within(bar).getByRole('button', { name: 'Unlock' }));
      expect(sheet()).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('unlock sheet edge cases', () => {
  // staff whose phone forgot the username get a way out instead of a pad that never works
  it('T66', async () => {
    rememberStaff();
    ref.fake.signIn('u-anna');
    shell();
    fireEvent.click(await screen.findByRole('button', { name: 'Lock' }));
    localStorage.removeItem(LAST_STAFF_KEY);
    fireEvent.click(await screen.findByRole('button', { name: /Locked, view only/ }));
    await findSheet();
    expect(within(sheet()).getByText(/Sign out and sign in again/)).toBeTruthy();
    expect(within(sheet()).queryByRole('button', { name: '1' })).toBeNull();
    fireEvent.click(within(sheet()).getByRole('button', { name: /Sign out/ }));
    await waitFor(() => expect(ref.fake.signOutScopes).toEqual(['local']));
  });

  // Tab inside the open sheet stays inside it
  it('T67', async () => {
    await lockedAsStaff();
    const buttons = within(sheet()).getAllByRole('button').filter((b) => !(b as HTMLButtonElement).disabled);
    buttons[buttons.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });
});
