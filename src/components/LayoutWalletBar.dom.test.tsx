// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { walletApp } from '../test/walletTestKit';
import Layout from './Layout';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase(twoWalletRows());
});
afterEach(cleanup);

describe('page shell with a wallet', () => {
  it('shows the open wallet’s name in the app bar on every page', async () => {
    render(
      walletApp(
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<p>home</p>} />
          </Route>
        </Routes>,
        { current: 'wb' },
      ),
    );
    expect(await screen.findByRole('button', { name: /Spring Convention 2027/ })).toBeTruthy();
  });
});
