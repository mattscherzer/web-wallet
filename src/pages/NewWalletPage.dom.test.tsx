// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { memoryStorage, walletApp } from '../test/walletTestKit';
import { CURRENT_WALLET_KEY } from '../wallet/walletStore';
import NewWalletPage from './NewWalletPage';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase(twoWalletRows());
});
afterEach(cleanup);

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function setup() {
  const storage = memoryStorage({ [CURRENT_WALLET_KEY]: 'wa' });
  render(
    walletApp(
      <Routes>
        <Route path="/wallets/new" element={<NewWalletPage />} />
        <Route path="*" element={<Where />} />
      </Routes>,
      { path: '/wallets/new', storage },
    ),
  );
  return storage;
}

const type = (v: string) =>
  fireEvent.change(screen.getByLabelText('Wallet name'), { target: { value: v } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create wallet' }));

describe('New wallet', () => {
  it('asks for a name when it is blank and creates nothing', async () => {
    setup();
    type('   ');
    submit();
    expect((await screen.findByRole('alert')).textContent).toMatch(/enter a wallet name/i);
    expect(ref.fake.tables.wallets).toHaveLength(2);
  });

  it('creates the wallet, makes it the current one and goes to the overview', async () => {
    const storage = setup();
    type('Autumn Retreat');
    submit();
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
    const created = ref.fake.tables.wallets.find((w) => w.name === 'Autumn Retreat');
    expect(created).toBeTruthy();
    expect(storage.mem.get(CURRENT_WALLET_KEY)).toBe(created?.id);
  });

  it('says when the name is already used', async () => {
    setup();
    ref.fake.failNext('wallets:insert', { code: '23505', message: 'duplicate' });
    type('Thursday SLAA Meeting');
    submit();
    expect((await screen.findByRole('alert')).textContent).toMatch(/already exists/i);
  });

  it('shows an error and stays put when saving fails', async () => {
    const storage = setup();
    ref.fake.failNext('wallets:insert', { message: 'boom' });
    type('Autumn Retreat');
    submit();
    expect((await screen.findByRole('alert')).textContent).toMatch(/couldn.t create/i);
    expect(screen.queryByTestId('where')).toBeNull();
    expect(storage.mem.get(CURRENT_WALLET_KEY)).toBe('wa');
  });
});
