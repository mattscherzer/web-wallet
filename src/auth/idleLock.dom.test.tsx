// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

function LockButton() {
  const { lock } = useAuth();
  return <button onClick={() => void lock()}>Lock</button>;
}

async function openApp() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <AuthGate>
          <p>secret app</p>
          <LockButton />
        </AuthGate>
      </AuthProvider>
    </MemoryRouter>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.queryByText('secret app')).not.toBeNull();
}
const pass = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const locked = () => screen.queryByLabelText('Username') !== null && screen.queryByText('secret app') === null;

describe('inactivity lock', () => {
  it('T18 the app is 30 minutes (not less) of inactivity from locking, activity restarts the clock, and Lock locks at once', async () => {
    expect(IDLE_LOCK_MS).toBe(30 * MIN);
    await openApp();

    await pass(29 * MIN);
    expect(locked()).toBe(false);
    fireEvent.keyDown(document, { key: 'a' });
    await pass(29 * MIN);
    expect(locked()).toBe(false);
    fireEvent.pointerDown(document);
    await pass(29 * MIN);
    expect(locked()).toBe(false);

    await pass(2 * MIN);
    expect(locked()).toBe(true);
    // Locking signs out on this device only, not the same account's other devices.
    expect(ref.fake.signOutScopes).toEqual(['local']);
  });

  it('T18b the Lock button locks immediately', async () => {
    await openApp();
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    await pass(10);
    expect(locked()).toBe(true);
    expect(ref.fake.signOutScopes).toEqual(['local']);
  });

  it('T18c a phone that slept past the timeout locks as soon as the app is opened again', async () => {
    await openApp();
    // No timer fires while the device is suspended: only the clock moves on.
    vi.setSystemTime(Date.now() + 45 * MIN);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await pass(10);
    expect(locked()).toBe(true);
  });
});

describe('inactivity lock across a closed app', () => {
  it('T18d an app reopened after more than 30 minutes asks for the login again, one reopened sooner does not', async () => {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now() - 45 * MIN));
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthGate>
            <p>secret app</p>
          </AuthGate>
        </AuthProvider>
      </MemoryRouter>,
    );
    await pass(50);
    expect(locked()).toBe(true);
    cleanup();

    ref.fake.signIn('u-anna');
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now() - 10 * MIN));
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthGate>
            <p>secret app</p>
          </AuthGate>
        </AuthProvider>
      </MemoryRouter>,
    );
    await pass(50);
    expect(screen.queryByText('secret app')).not.toBeNull();
  });
});
