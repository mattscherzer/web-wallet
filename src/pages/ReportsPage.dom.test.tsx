// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { reportRows, TODAY } from '../test/reportsTestKit';
import { walletApp } from '../test/walletTestKit';
import ReportsPage from './ReportsPage';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy(
    {},
    {
      get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string],
    },
  ),
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
  ref.fake = createFakeSupabase(twoWalletRows());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const open = (rows = reportRows()) => {
  ref.fake = createFakeSupabase(rows);
  render(walletApp(<ReportsPage />, { current: 'wb' }));
};
const summary = async (title: string) => within(await screen.findByRole('region', { name: title }));

describe('Reports header', () => {
  it('names the wallet the report is for', async () => {
    render(walletApp(<ReportsPage />, { current: 'wb' }));
    expect(await screen.findByText('Spring Convention 2027')).toBeTruthy();
  });
});

describe('Reports summary', () => {
  it('shows this month up to today with the design example figures', async () => {
    open();
    const card = await summary('1–24 September 2026');
    expect(card.getByText('Available on 1 Sep').nextSibling?.textContent).toBe('€1,064.40');
    expect(card.getByText('Money in').nextSibling?.textContent).toBe('+€295.90');
    expect(card.getByText('Money out').nextSibling?.textContent).toBe('−€100.00');
    expect(card.getByText('Moved to reserve').nextSibling?.textContent).toBe('−€50.00');
    expect(card.getByText('Available on 24 Sep').nextSibling?.textContent).toBe('€1,210.30');
    expect(card.getByText('Reserve (not available)').nextSibling?.textContent).toBe('€600.00');
  });

  it('lists the newest entries first with the balances after each', async () => {
    open();
    await summary('1–24 September 2026');
    const rows = within(screen.getByRole('region', { name: 'Ledger preview' })).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('12 Sep');
    expect(rows[0].textContent).toContain('Money out −€50.00');
    expect(rows[0].textContent).toContain('Available €1,210.30 · Reserve €600.00');
    expect(screen.getByText(/Newest first · 4 entries/)).toBeTruthy();
    expect(within(rows[0]).getByRole('link').getAttribute('href')).toMatch(/^\/history\/.+/);
  });

  it('switches to last month and marks the chosen period', async () => {
    open();
    await summary('1–24 September 2026');
    const thisMonth = screen.getByRole('button', { name: 'This month' });
    const lastMonth = screen.getByRole('button', { name: 'Last month' });
    expect(thisMonth.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(lastMonth);
    const card = await summary('1–31 August 2026');
    expect(card.getByText('Available on 31 Aug').nextSibling?.textContent).toBe('€1,064.40');
    expect(lastMonth.getAttribute('aria-pressed')).toBe('true');
    expect(thisMonth.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('Reports with nothing in the period', () => {
  it('says so and offers to show the previous month', async () => {
    open(reportRows({ september: false }));
    expect(await screen.findByRole('heading', { name: 'Nothing to report for September' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show August 2026' }));
    expect(await screen.findByRole('region', { name: '1–31 August 2026' })).toBeTruthy();
    expect(screen.queryByText(/Nothing to report/)).toBeNull();
  });

  it('opens the period sheet from "Pick another period"', async () => {
    open(reportRows({ september: false }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pick another period' }));
    expect(screen.getByRole('dialog', { name: 'Report period' })).toBeTruthy();
  });
});

describe('Reports loading', () => {
  it('shows a loading state, then offers a retry when the entries cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    ref.fake = createFakeSupabase(reportRows());
    ref.fake.failNext('transactions:select', { message: 'offline' });
    render(walletApp(<ReportsPage />, { current: 'wb' }));
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Couldn’t load the report. Check your connection and try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: '1–24 September 2026' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
