// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../auth/AuthProvider';
import { OwnerConfirmProvider } from '../auth/OwnerConfirm';
import {
  createFakeSupabase,
  FAKE_MEMBERS,
  FAKE_PERMISSIONS,
  FAKE_PROFILES,
  FAKE_USERS,
  twoWalletRows,
  type FakeSupabase,
} from '../test/fakeSupabase';
import { WalletProvider } from '../wallet/WalletProvider';
import { useWallet } from '../wallet/useWallet';
import AdminPage from './AdminPage';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string] }),
}));
vi.mock('../auth/passwordCheck', () => ({ checkOwnerPassword: async (_e: string, p: string) => p === 'owner-pw' }));

beforeEach(() => {
  ref.fake = createFakeSupabase(
    { ...twoWalletRows(), profiles: FAKE_PROFILES, wallet_members: FAKE_MEMBERS, role_permissions: FAKE_PERMISSIONS },
    { users: FAKE_USERS },
  );
  const staff = [{ user_id: 'u-anna', username: 'anna', display_name: 'Anna', wallet_id: 'wa', disabled: false }];
  ref.fake.answerFunction('staff-admin', (body) => {
    const b = body as { action: string; user_id?: string };
    if (b.action === 'list') return { data: { staff } };
    if (b.action === 'disable' || b.action === 'enable') staff[0].disabled = b.action === 'disable';
    return { data: { id: 'new-staff' } };
  });
});
afterEach(cleanup);

function open(userId: string) {
  ref.fake.signIn(userId);
  render(
    <MemoryRouter>
      <AuthProvider>
        <OwnerConfirmProvider>
          <AdminPage />
        </OwnerConfirmProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
async function confirmPassword() {
  fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'owner-pw' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
}
const calls = () =>
  ref.fake.invocations.filter((i) => (i.body as { action: string }).action !== 'list').map((i) => i.body);

describe('Wallets and staff page', () => {
  it('T30 disabling staff asks first ("Disable Anna?"); Keep Anna does nothing', async () => {
    open('u-owner');
    fireEvent.click(await screen.findByRole('button', { name: 'Disable Anna' }));
    const ask = within(await screen.findByRole('dialog', { name: 'Disable Anna?' }));
    expect(ask.getByText(/can no longer sign in/)).toBeTruthy();
    fireEvent.click(ask.getByRole('button', { name: 'Keep Anna' }));
    expect(screen.queryByRole('dialog', { name: 'Disable Anna?' })).toBeNull();
    expect(calls()).toEqual([]);
  });

  it('T31 staff who open this page get "Owners only", an explanation and a way back to More', async () => {
    open('u-anna');
    expect(await screen.findByRole('heading', { name: 'Owners only' })).toBeTruthy();
    expect(screen.getByText(/Only the owner can manage wallets and staff/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to More' }).getAttribute('href')).toBe('/more');
  });

  it('T11 staff are told the page is for owners and get no controls', async () => {
    open('u-anna');
    expect(await screen.findByText(/owners only/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /create wallet/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /add staff/i })).toBeNull();
    expect(ref.fake.invocations).toEqual([]);
  });

  it('T12 the owner creates a wallet, adds staff with a 6-digit PIN, resets a PIN and disables staff', async () => {
    open('u-owner');
    expect(await screen.findByText('Anna')).toBeTruthy();

    // Create a wallet: asks for the password once.
    type('Wallet name', 'Autumn Retreat');
    fireEvent.click(screen.getByRole('button', { name: /create wallet/i }));
    await confirmPassword();
    await waitFor(() => expect(ref.fake.tables.wallets.map((w) => w.name)).toContain('Autumn Retreat'));
    expect(ref.fake.rpcCalls).toEqual([{ name: 'create_wallet', args: { name: 'Autumn Retreat' } }]);

    // Add staff opens a bottom sheet: the PIN must be exactly 6 digits.
    fireEvent.click(screen.getByRole('button', { name: 'Add staff' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Add staff' }));
    type('Username', 'mia');
    type('Name shown in the history', 'Mia');
    type('PIN', '1234');
    fireEvent.click(sheet.getByRole('button', { name: 'Add staff' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/6 digits/i);
    expect(calls()).toEqual([]);
    type('PIN', '246810');
    fireEvent.click(sheet.getByRole('button', { name: 'Add staff' }));
    await waitFor(() => expect(calls()).toHaveLength(1));
    expect(calls()[0]).toEqual({
      action: 'create',
      wallet_id: 'wa',
      username: 'mia',
      display_name: 'Mia',
      pin: '246810',
    });

    // Reset a PIN.
    fireEvent.click(screen.getByRole('button', { name: 'Reset PIN for Anna' }));
    type('New PIN for Anna', '135790');
    fireEvent.click(screen.getByRole('button', { name: 'Save PIN' }));
    await waitFor(() => expect(calls()).toHaveLength(2));
    expect(calls()[1]).toEqual({ action: 'reset_pin', user_id: 'u-anna', pin: '135790' });

    // Disable asks first, then re-enable does not.
    fireEvent.click(screen.getByRole('button', { name: 'Disable Anna' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Disable Anna?' })).getByRole('button', { name: 'Disable Anna' }));
    await waitFor(() => expect(calls()).toHaveLength(3));
    expect(calls()[2]).toEqual({ action: 'disable', user_id: 'u-anna' });
    fireEvent.click(await screen.findByRole('button', { name: 'Enable Anna' }));
    await waitFor(() => expect(calls()).toHaveLength(4));
    expect(calls()[3]).toEqual({ action: 'enable', user_id: 'u-anna' });
  });
});

function WalletCount() {
  const { wallets } = useWallet();
  return <p data-testid="wallet-count">{wallets.length}</p>;
}

describe('Wallets and staff page and the wallet list', () => {
  it('T12b a wallet the owner creates shows up in the wallet list at once, without reloading the app', async () => {
    ref.fake.signIn('u-owner');
    render(
      <MemoryRouter>
        <AuthProvider>
          <OwnerConfirmProvider>
            <WalletProvider storage={{ getItem: () => null, setItem: () => {} }}>
              <WalletCount />
              <AdminPage />
            </WalletProvider>
          </OwnerConfirmProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('wallet-count').textContent).toBe('2'));
    fireEvent.change(await screen.findByLabelText('Wallet name'), { target: { value: 'Autumn Retreat' } });
    fireEvent.click(screen.getByRole('button', { name: /create wallet/i }));
    await confirmPassword();
    await waitFor(() => expect(screen.getByTestId('wallet-count').textContent).toBe('3'));
  });
});
