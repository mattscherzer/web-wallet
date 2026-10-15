// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
import { AuthGate } from './AuthGate';
import { IDLE_LOCK_MS, LAST_ACTIVITY_KEY } from './idleLock';
import { useAuth } from './useAuth';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string] }),
}));

const MIN = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  ref.fake = createFakeSupabase(
    { ...twoWalletRows(), profiles: FAKE_PROFILES, wallet_members: FAKE_MEMBERS, role_permissions: FAKE_PERMISSIONS },
    { users: FAKE_USERS },
  );
  ref.fake.signIn('u-anna');
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Probe() {
  const { lock, locked, signOut } = useAuth();
  return (
    <>
      <p data-testid="state">{locked ? 'locked' : 'unlocked'}</p>
      <button onClick={() => void lock()}>Lock</button>
      <button onClick={() => void signOut()}>Sign out</button>
    </>
  );
}

const tree = (
  <MemoryRouter>
    <AuthProvider>
      <AuthGate>
        <p>the books</p>
        <Probe />
      </AuthGate>
    </AuthProvider>
  </MemoryRouter>
);
async function openApp() {
  render(tree);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.queryByText('the books')).not.toBeNull();
}
const pass = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const state = () => screen.getByTestId('state').textContent;
/** Locked = still signed in (the books are shown), but marked locked. Never the login form. */
const signedInAndLocked = () =>
  state() === 'locked' && screen.queryByText('the books') !== null && screen.queryByLabelText('Username') === null;

describe('inactivity lock', () => {
  it('T1 30 minutes without use locks the app, 29 do not, and the person stays signed in', async () => {
    expect(IDLE_LOCK_MS).toBe(30 * MIN);
    await openApp();

    await pass(29 * MIN);
    expect(state()).toBe('unlocked');
    fireEvent.keyDown(document, { key: 'a' });
    await pass(29 * MIN);
    expect(state()).toBe('unlocked');
    fireEvent.pointerDown(document);
    await pass(29 * MIN);
    expect(state()).toBe('unlocked');

    await pass(2 * MIN);
    expect(signedInAndLocked()).toBe(true);
    expect(ref.fake.signOutScopes).toEqual([]);
  });

  it('T2 the Lock button locks at once without signing out; only Sign out ends the session', async () => {
    await openApp();
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    await pass(10);
    expect(signedInAndLocked()).toBe(true);
    expect(ref.fake.signOutScopes).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await pass(10);
    expect(ref.fake.signOutScopes).toEqual(['local']);
    expect(screen.queryByLabelText('Username')).not.toBeNull();
  });

  it('T3 a phone that slept past the timeout is locked as soon as the app is opened again', async () => {
    await openApp();
    vi.setSystemTime(Date.now() + 45 * MIN);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await pass(10);
    expect(signedInAndLocked()).toBe(true);
    expect(ref.fake.signOutScopes).toEqual([]);
  });
});

describe('the lock across a closed app', () => {
  it('T4 reopened after more than 30 minutes comes back locked (and keeps the chosen wallet), sooner comes back open', async () => {
    localStorage.setItem('treasury.currentWalletId', 'wa');
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now() - 45 * MIN));
    render(tree);
    await pass(50);
    expect(signedInAndLocked()).toBe(true);
    expect(ref.fake.signOutScopes).toEqual([]);
    expect(localStorage.getItem('treasury.currentWalletId')).toBe('wa');
    cleanup();

    localStorage.clear();
    ref.fake.signIn('u-anna');
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now() - 10 * MIN));
    render(tree);
    await pass(50);
    expect(state()).toBe('unlocked');
  });

  it('T5 a locked app stays locked after a reload, however soon', async () => {
    await openApp();
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    await pass(10);
    cleanup();

    render(tree);
    await pass(50);
    expect(signedInAndLocked()).toBe(true);
  });

  it('T6 the sign-in event supabase repeats on refocus does not unlock a locked app', async () => {
    await openApp();
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    await pass(10);
    ref.fake.signIn('u-anna'); // sets the session again and emits SIGNED_IN
    await pass(50);
    expect(signedInAndLocked()).toBe(true);
  });

  it('T7 signing out clears the lock and forgets the chosen wallet; the next sign-in starts unlocked', async () => {
    localStorage.setItem('treasury.currentWalletId', 'wa');
    await openApp();
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    await pass(10);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await pass(10);
    expect(localStorage.getItem('treasury.currentWalletId')).toBeNull();
    cleanup();

    ref.fake.signIn('u-anna');
    render(tree);
    await pass(50);
    expect(state()).toBe('unlocked');
  });
});
