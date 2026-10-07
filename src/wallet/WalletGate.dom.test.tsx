// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { walletApp } from '../test/walletTestKit';
import WalletGate from './WalletGate';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

afterEach(cleanup);

const gate = (path = '/') => render(walletApp(<WalletGate><p>the app</p></WalletGate>, { path }));

describe('wallet gate', () => {
  it('shows the Welcome screen when there is no wallet yet', async () => {
    ref.fake = createFakeSupabase({ wallets: [] });
    gate();
    expect(await screen.findByRole('link', { name: /Create a wallet/ })).toBeTruthy();
    expect(screen.queryByText('the app')).toBeNull();
  });

  it('still lets the New wallet screen through when there is no wallet yet', async () => {
    ref.fake = createFakeSupabase({ wallets: [] });
    gate('/wallets/new');
    expect(await screen.findByText('the app')).toBeTruthy();
  });

  it('shows the app when a wallet exists', async () => {
    ref.fake = createFakeSupabase(twoWalletRows());
    gate();
    expect(await screen.findByText('the app')).toBeTruthy();
  });

  it('shows an error with Retry, not Welcome, when wallets cannot be loaded', async () => {
    ref.fake = createFakeSupabase(twoWalletRows());
    ref.fake.failNext('wallets:select', { message: 'offline' });
    gate();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Create a wallet/ })).toBeNull();
  });

  it('shows a loading state first', () => {
    ref.fake = createFakeSupabase(twoWalletRows());
    gate();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
  });
});

beforeEach(() => {
  ref.fake = createFakeSupabase(twoWalletRows());
});
