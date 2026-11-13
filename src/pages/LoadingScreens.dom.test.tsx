// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthProvider';
import { OwnerConfirmProvider } from '../auth/OwnerConfirm';
import {
  createFakeSupabase,
  FAKE_MEMBERS,
  FAKE_PERMISSIONS,
  FAKE_PROFILES,
  FAKE_USERS,
  type FakeSupabase,
} from '../test/fakeSupabase';
import { transactionRows } from '../test/transactionsTestKit';
import { walletApp } from '../test/walletTestKit';
import DashboardPage from './DashboardPage';
import HistoryPage from './HistoryPage';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string] }),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase(
    { ...transactionRows(), profiles: FAKE_PROFILES, wallet_members: FAKE_MEMBERS, role_permissions: FAKE_PERMISSIONS },
    { users: FAKE_USERS },
  );
});
afterEach(cleanup);

function show(node: React.ReactNode) {
  ref.fake.signIn('u-anna');
  render(
    <AuthProvider>
      <OwnerConfirmProvider>{walletApp(node, { current: 'wa' })}</OwnerConfirmProvider>
    </AuthProvider>,
  );
}

describe('loading screens follow the LoadingOverview and LoadingHistory designs', () => {
  it('Overview shows its skeleton, never €0.00, until the balances arrive', async () => {
    const release = ref.fake.holdNext('transactions:select');
    show(<DashboardPage />);
    expect(await screen.findByRole('status', { name: 'Loading' })).toBeTruthy();
    expect(screen.queryByText('Available to spend')).toBeNull();
    expect(screen.queryByText('€0.00')).toBeNull();

    release();
    expect(await screen.findByText('Available to spend')).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
  });

  it('History shows its skeleton, not "No entries yet", until the entries arrive', async () => {
    const release = ref.fake.holdNext('transactions:select');
    show(<HistoryPage />);
    expect(await screen.findByRole('heading', { name: 'History' })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
    expect(screen.queryByText('No entries yet')).toBeNull();
    expect(screen.queryByRole('searchbox', { name: 'Search history' })).toBeNull();

    release();
    expect(await screen.findByRole('searchbox', { name: 'Search history' })).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
  });

  it('Overview says its first load failed and loads again on Try again', async () => {
    ref.fake.failNext('transactions:select', { message: 'network down' });
    show(<DashboardPage />);
    expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t load your balances');
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Available to spend')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('History says its first load failed and loads again on Try again', async () => {
    ref.fake.failNext('transactions:select', { message: 'network down' });
    show(<HistoryPage />);
    expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t load the history');
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('searchbox', { name: 'Search history' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
