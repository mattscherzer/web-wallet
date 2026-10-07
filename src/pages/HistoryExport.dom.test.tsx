// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { walletApp } from '../test/walletTestKit';
import HistoryPage from './HistoryPage';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

let blobs: Blob[];
beforeEach(() => {
  ref.fake = createFakeSupabase(twoWalletRows());
  blobs = [];
  URL.createObjectURL = (b: Blob | MediaSource) => {
    blobs.push(b as Blob);
    return 'blob:test';
  };
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('History page export', () => {
  it('exports the open wallet’s entries under its name', async () => {
    render(walletApp(<HistoryPage />, { current: 'wb' }));
    // The button is clickable before the wallet has loaded; keep pressing until the export happens.
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
      expect(blobs.length).toBeGreaterThan(0);
    });
    const text = await blobs[0].text();
    expect(text.split('\n')[0]).toBe('Wallet,"Spring Convention 2027"');
    expect(text).toContain('b1');
    expect(text).not.toMatch(/a1|a2|a3/);
  });
});
