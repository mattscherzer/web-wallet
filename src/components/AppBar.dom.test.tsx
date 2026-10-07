// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { walletApp } from '../test/walletTestKit';
import AppBar from './AppBar';

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
  render(
    walletApp(
      <Routes>
        <Route path="*" element={<><AppBar /><Where /></>} />
      </Routes>,
      { path: '/history', current: 'wa' },
    ),
  );
}

const barButton = (name: RegExp) => screen.findByRole('button', { name });

describe('app bar', () => {
  it('shows the current wallet’s name', async () => {
    setup();
    expect(await barButton(/Thursday SLAA Meeting/)).toBeTruthy();
  });

  it('draws nothing when there is no wallet context', () => {
    const { container } = render(<AppBar />);
    expect(container.textContent).toBe('');
  });
});

describe('wallet switcher', () => {
  async function open() {
    setup();
    fireEvent.click(await barButton(/Thursday SLAA Meeting/));
    return screen.findByRole('dialog', { name: 'Wallets' });
  }

  it('lists every wallet with its available balance', async () => {
    const dialog = await open();
    expect(await within(dialog).findByText(/949\.80/)).toBeTruthy();
    const b = within(dialog).getByRole('button', { name: /Spring Convention 2027/ });
    expect(b.textContent).toMatch(/7\.00/);
  });

  it('marks the current wallet', async () => {
    const dialog = await open();
    expect(within(dialog).getByRole('button', { name: /Thursday SLAA Meeting/ }).getAttribute('aria-current')).toBe('true');
    expect(within(dialog).getByRole('button', { name: /Spring Convention 2027/ }).getAttribute('aria-current')).toBeNull();
  });

  it('switches wallet, closes the sheet and returns to the overview', async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole('button', { name: /Spring Convention 2027/ }));
    expect(await barButton(/Spring Convention 2027/)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('where').textContent).toBe('/');
  });

  it('offers New wallet', async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole('button', { name: /New wallet/ }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/wallets/new'));
  });
});
