// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthProvider';
import { OwnerConfirmProvider } from '../auth/OwnerConfirm';
import WalletGate from '../wallet/WalletGate';
import {
  createFakeSupabase,
  FAKE_MEMBERS,
  FAKE_PERMISSIONS,
  FAKE_PROFILES,
  FAKE_USERS,
  twoWalletRows,
  type FakeSupabase,
} from '../test/fakeSupabase';
import { transactionRows } from '../test/transactionsTestKit';
import { walletApp } from '../test/walletTestKit';
import HistoryPage from './HistoryPage';
import MorePage from './MorePage';
import NewWalletPage from './NewWalletPage';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string] }),
}));
vi.mock('../auth/passwordCheck', () => ({ checkOwnerPassword: async (_e: string, p: string) => p === 'owner-pw' }));

function seed(rows: Record<string, Record<string, unknown>[]>) {
  ref.fake = createFakeSupabase(
    { ...rows, profiles: FAKE_PROFILES, wallet_members: FAKE_MEMBERS, role_permissions: FAKE_PERMISSIONS },
    { users: FAKE_USERS },
  );
}
beforeEach(() => seed(twoWalletRows()));
afterEach(cleanup);

function show(userId: string, node: React.ReactNode, path = '/') {
  ref.fake.signIn(userId);
  render(
    <AuthProvider>
      <OwnerConfirmProvider>{walletApp(node, { current: 'wa', path })}</OwnerConfirmProvider>
    </AuthProvider>,
  );
}

describe('staff with no wallet', () => {
  it('T32 sees "No wallet yet" with the explanation, and Sign out ends the session', async () => {
    seed({ ...twoWalletRows(), wallets: [] });
    show('u-anna', <WalletGate><p>the books</p></WalletGate>);
    expect(await screen.findByRole('heading', { name: 'No wallet yet' })).toBeTruthy();
    expect(screen.getByText('You aren’t a member of any wallet yet. Ask the owner to add you.')).toBeTruthy();
    expect(screen.queryByText('the books')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(ref.fake.signOutScopes).toEqual(['local']));
  });

  it('T33 an owner with no wallet is welcomed and offered Create a wallet', async () => {
    seed({ ...twoWalletRows(), wallets: [] });
    show('u-owner', <WalletGate><p>the books</p></WalletGate>);
    expect(await screen.findByRole('heading', { name: 'Keep your group’s books, together' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Create a wallet/ }).getAttribute('href')).toBe('/wallets/new');
  });
});

describe('More', () => {
  it('T34 shows who is signed in (name, role, email) with Lock and a separate Sign out of this phone', async () => {
    show('u-owner', <MorePage />);
    const card = await screen.findByText('Olga');
    expect(card).toBeTruthy();
    expect(screen.getByText('Owner · olga@x.org')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lock' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Wallets and staff/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of this phone' }));
    await waitFor(() => expect(ref.fake.signOutScopes).toEqual(['local']));
  });

  it('T35 staff see no Wallets and staff link', async () => {
    show('u-anna', <MorePage />);
    await screen.findByText('Anna');
    expect(screen.getByText(/^Staff · /)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Wallets and staff/ })).toBeNull();
  });
});

describe('other screens', () => {
  it('T36 an empty history explains itself and offers to record money in', async () => {
    seed({ ...transactionRows(), transactions: [] });
    show('u-anna', <HistoryPage />);
    expect(await screen.findByText('No entries yet')).toBeTruthy();
    expect(screen.getByText('Money in, money out and transfers you record appear here, newest first.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Record money in' }).getAttribute('href')).toBe('/record?type=in');
  });

  it('T37 a wrong password in the owner confirmation says so in the dialog and Cancel closes it', async () => {
    show('u-owner', <NewWalletPage />);
    fireEvent.change(await screen.findByLabelText('Wallet name'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /create wallet/i }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Confirm your password' }));
    fireEvent.change(dialog.getByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Confirm' }));
    expect((await dialog.findByRole('alert')).textContent).toBe('That password isn’t right');
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Confirm your password' })).toBeNull();
    expect(ref.fake.rpcCalls).toEqual([]);
  });
});
