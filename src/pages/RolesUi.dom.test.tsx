// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { AuthProvider } from '../auth/AuthProvider';
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
import WalletSwitcher from '../components/WalletSwitcher';
import EntryPage from './EntryPage';
import HistoryPage from './HistoryPage';
import MorePage from './MorePage';

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

function show(userId: string, node: React.ReactNode, path = '/') {
  ref.fake.signIn(userId);
  render(<AuthProvider>{walletApp(node, { current: 'wa', path })}</AuthProvider>);
}
const entry = (
  <Routes>
    <Route path="/history/:id" element={<EntryPage />} />
  </Routes>
);

describe('what each role is offered', () => {
  it('T20 staff see no New wallet, Restore, Export or staff page; the owner sees all of them', async () => {
    // Staff
    show('u-anna', <WalletSwitcher onClose={() => {}} />);
    await screen.findByText('Thursday SLAA Meeting');
    await waitFor(() => expect(screen.queryByRole('button', { name: /New wallet/ })).toBeNull());
    cleanup();

    show('u-anna', entry, '/history/t5'); // t5 is a removed entry
    await screen.findByText('Removed', { selector: '[data-status="removed"]' });
    expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();
    cleanup();

    show('u-anna', <HistoryPage />);
    await screen.findByRole('heading', { name: /History/i });
    expect(screen.queryByRole('button', { name: /Export CSV/ })).toBeNull();
    cleanup();

    show('u-anna', <MorePage />);
    await screen.findByText(/Signed in as Anna/);
    expect(screen.queryByRole('link', { name: /Wallets and staff/ })).toBeNull();
    cleanup();

    // Owner
    show('u-owner', <WalletSwitcher onClose={() => {}} />);
    expect(await screen.findByRole('button', { name: /New wallet/ })).toBeTruthy();
    cleanup();

    show('u-owner', entry, '/history/t5');
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeTruthy();
    cleanup();

    show('u-owner', <HistoryPage />);
    expect(await screen.findByRole('button', { name: /Export CSV/ })).toBeTruthy();
    cleanup();

    show('u-owner', <MorePage />);
    expect(await screen.findByRole('link', { name: /Wallets and staff/ })).toBeTruthy();
  });

  it("T20b staff can still remove an entry they made, but not someone else's", async () => {
    ref.fake.tables.transactions.find((t) => t.id === 't1')!.created_by = 'u-anna';
    show('u-anna', entry, '/history/t1');
    expect(await screen.findByRole('button', { name: 'Remove' })).toBeTruthy();
    cleanup();
    show('u-anna', entry, '/history/t2');
    await screen.findByRole('heading', { name: /100/ });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull());
  });
});
