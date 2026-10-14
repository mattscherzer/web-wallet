// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { createFakeSupabase, FAKE_PROFILES, FAKE_USERS, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import AdminPage from './AdminPage';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy(
    {},
    { get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string] },
  ),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase(
    { ...twoWalletRows(), profiles: FAKE_PROFILES, wallet_members: [] },
    { users: FAKE_USERS },
  );
});
afterEach(cleanup);

function open(userId: string) {
  ref.fake.signIn(userId);
  render(
    <MemoryRouter>
      <AuthProvider>
        <AdminPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminPage', () => {
  it('T11 a normal user is told the page is for admins and gets no controls', async () => {
    open('u-anna');
    expect(await screen.findByText(/admins only/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /create wallet/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /create user/i })).toBeNull();
    expect(ref.fake.tables.wallets).toHaveLength(2);
  });

  it('T12 an admin creates a wallet, creates a user with wallets, and adds a member to a wallet', async () => {
    open('u-admin');
    fireEvent.change(await screen.findByLabelText('Wallet name'), { target: { value: 'Autumn Retreat' } });
    fireEvent.click(screen.getByRole('button', { name: /create wallet/i }));
    await waitFor(() => expect(ref.fake.tables.wallets.map((w) => w.name)).toContain('Autumn Retreat'));

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nina@x.org' } });
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Nina' } });
    fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'start-pw-123' } });
    fireEvent.click(await screen.findByLabelText('Spring Convention 2027'));
    fireEvent.click(screen.getByRole('button', { name: /create user/i }));
    await waitFor(() => expect(ref.fake.invocations).toHaveLength(1));
    expect(ref.fake.invocations[0]).toEqual({
      name: 'admin-create-user',
      body: { email: 'nina@x.org', password: 'start-pw-123', displayName: 'Nina', walletIds: ['wb'] },
    });

    fireEvent.change(screen.getByLabelText('Member'), { target: { value: 'u-anna' } });
    fireEvent.change(screen.getByLabelText('Wallet'), { target: { value: 'wa' } });
    fireEvent.click(screen.getByRole('button', { name: /add member/i }));
    await waitFor(() => expect(ref.fake.tables.wallet_members).toEqual([{ id: expect.any(String), deleted: false, created_at: expect.any(String), user_id: 'u-anna', wallet_id: 'wa' }]));
  });
});
