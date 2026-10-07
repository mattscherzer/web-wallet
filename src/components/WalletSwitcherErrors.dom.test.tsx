// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { walletApp } from '../test/walletTestKit';
import AppBar from './AppBar';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase(twoWalletRows());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('wallet switcher when balances cannot be loaded', () => {
  it('says so, offers Retry, and shows the balances once it works', async () => {
    render(walletApp(<AppBar />, { current: 'wa' }));
    fireEvent.click(await screen.findByRole('button', { name: /Thursday SLAA Meeting/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Wallets' });
    // The wallet list is already loaded; only the balances request fails.
    ref.fake.failNext('transactions:select', { message: 'offline' });
    // Re-open so the failing request is the one the sheet makes.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    fireEvent.click(await screen.findByRole('button', { name: /Thursday SLAA Meeting/ }));
    const again = await screen.findByRole('dialog', { name: 'Wallets' });

    expect((await within(again).findByRole('alert')).textContent).toMatch(/couldn.t load the balances/i);
    expect(within(again).getAllByText('Balance unavailable').length).toBeGreaterThan(0);

    fireEvent.click(within(again).getByRole('button', { name: 'Retry' }));
    expect(await within(again).findByText(/949\.80/)).toBeTruthy();
    expect(within(again).queryByRole('alert')).toBeNull();
  });
});
