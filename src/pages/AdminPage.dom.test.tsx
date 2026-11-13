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
import AdminPage from './AdminPage';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string] }),
}));
vi.mock('../db/ownerPassword', () => ({ checkOwnerPassword: async (_e: string, p: string) => p === 'owner-pw' }));

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
  it('T11 staff are told the page is for owners and get no controls', async () => {
    open('u-anna');
    expect(await screen.findByText(/owners only/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to More' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /add staff/i })).toBeNull();
    expect(ref.fake.invocations).toEqual([]);
  });

  it('shows a skeleton of the page until wallets and staff have loaded', async () => {
    open('u-owner');
    expect(screen.getByRole('status', { name: /loading wallets and staff/i })).toBeTruthy();
    expect(await screen.findByText('Anna')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('T12 the owner adds staff with a 6-digit PIN, resets a PIN and disables and enables staff', async () => {
    open('u-owner');
    expect(await screen.findByText('Anna')).toBeTruthy();
    const sheet = () => within(screen.getByRole('dialog'));

    // Add staff: the PIN must be exactly 6 digits; the password is asked once.
    fireEvent.click(screen.getByRole('button', { name: 'Add staff' }));
    type('Username', 'mia');
    type('Name shown in the history', 'Mia');
    type('PIN', '1234');
    fireEvent.click(sheet().getByRole('button', { name: 'Add staff' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/6 digits/i);
    expect(calls()).toEqual([]);
    type('PIN', '246810');
    fireEvent.click(sheet().getByRole('button', { name: 'Add staff' }));
    await confirmPassword();
    await waitFor(() => expect(calls()).toHaveLength(1));
    expect(calls()[0]).toEqual({
      action: 'create',
      wallet_id: 'wa',
      username: 'mia',
      display_name: 'Mia',
      pin: '246810',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // Reset a PIN.
    fireEvent.click(screen.getByRole('button', { name: 'Reset PIN for Anna' }));
    expect(screen.getByRole('heading', { name: 'New PIN for Anna' })).toBeTruthy();
    type('New PIN', '135790');
    fireEvent.click(sheet().getByRole('button', { name: 'Save PIN' }));
    await waitFor(() => expect(calls()).toHaveLength(2));
    expect(calls()[1]).toEqual({ action: 'reset_pin', user_id: 'u-anna', pin: '135790' });

    // Disable asks first; "Keep" leaves things as they are.
    fireEvent.click(screen.getByRole('button', { name: 'Disable Anna' }));
    fireEvent.click(sheet().getByRole('button', { name: 'Keep Anna' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Disable Anna' }));
    fireEvent.click(sheet().getByRole('button', { name: 'Disable Anna' }));
    await waitFor(() => expect(calls()).toHaveLength(3));
    expect(calls()[2]).toEqual({ action: 'disable', user_id: 'u-anna' });

    // Enabling again needs no extra question.
    fireEvent.click(await screen.findByRole('button', { name: 'Enable Anna' }));
    await waitFor(() => expect(calls()).toHaveLength(4));
    expect(calls()[3]).toEqual({ action: 'enable', user_id: 'u-anna' });
  });

  it('says so when a staff list could not be loaded', async () => {
    ref.fake.answerFunction('staff-admin', () => ({ error: { message: 'boom' } }));
    open('u-owner');
    expect((await screen.findByRole('alert')).textContent).toMatch(/couldn.t load/i);
  });

  it('clears the load error when Retry succeeds', async () => {
    const answer = (body: unknown) => ({ data: { staff: [], body } });
    ref.fake.answerFunction('staff-admin', () => ({ error: { message: 'boom' } }));
    open('u-owner');
    const retry = await within(await screen.findByRole('alert')).findByRole('button', { name: 'Retry' });
    ref.fake.answerFunction('staff-admin', answer);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('shows a friendly message, not the raw error, when an owner action cannot reach the server', async () => {
    open('u-owner');
    await screen.findByText('Anna');
    fireEvent.click(screen.getByRole('button', { name: 'Add staff' }));
    ref.fake.answerFunction('staff-admin', () => ({
      error: { message: 'Failed to send a request to the Edge Function' },
    }));
    type('Username', 'mia');
    type('Name shown in the history', 'Mia');
    type('PIN', '246810');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add staff' }));
    await confirmPassword();
    const alert = await screen.findByText(/couldn.t do that/i);
    expect(alert.textContent).not.toMatch(/edge function/i);
  });

  it('keeps all six digits when a PIN is pasted with spaces', async () => {
    open('u-owner');
    fireEvent.click(await screen.findByRole('button', { name: 'Add staff' }));
    type('PIN', '123 456');
    expect((screen.getByLabelText('PIN') as HTMLInputElement).value).toBe('123456');
  });

  it('links to the new wallet screen instead of creating a wallet inline', async () => {
    open('u-owner');
    const link = await screen.findByRole('link', { name: 'New wallet' });
    expect(link.getAttribute('href')).toBe('/wallets/new');
  });
});
