// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase';
import { walletApp } from '../test/walletTestKit';
import { transactionRows } from '../test/transactionsTestKit';
import HistoryPage from './HistoryPage';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

beforeEach(() => {
  ref.fake = createFakeSupabase(transactionRows());
});
afterEach(cleanup);

describe('History page', () => {
  it('filters by type, searches, and reveals removed entries on request', async () => {
    render(walletApp(<HistoryPage />, { current: 'wa', path: '/history' }));
    expect(await screen.findByText(/a1/)).toBeTruthy();
    expect(screen.getByText(/a2/)).toBeTruthy();
    expect(screen.queryByText(/a5 dup/)).toBeNull();

    // Each row opens its entry.
    expect(screen.getByText(/a1/).closest('a')?.getAttribute('href')).toBe('/history/t1');

    fireEvent.click(screen.getByRole('button', { name: 'Money out' }));
    expect(await screen.findByText(/a2/)).toBeTruthy();
    expect(screen.queryByText(/a1/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search history' }), { target: { value: 'a3' } });
    expect(await screen.findByText(/a3/)).toBeTruthy();
    expect(screen.queryByText(/a1/)).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search history' }), { target: { value: '' } });

    const toggle = await screen.findByRole('button', { name: /Removed/ });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(await screen.findByText(/a5 dup/)).toBeTruthy();
    expect(screen.getByText('Removed', { selector: '[data-status="removed"]' })).toBeTruthy();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });
});
