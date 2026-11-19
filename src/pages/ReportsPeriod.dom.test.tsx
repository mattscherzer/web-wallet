// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase';
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
  ref.fake = createFakeSupabase(reportRows());
  render(walletApp(<ReportsPage />, { current: 'wb' }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const openSheet = async () => {
  await screen.findByRole('region', { name: '1–24 September 2026' });
  fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
  return within(screen.getByRole('dialog', { name: 'Report period' }));
};
const dates = (sheet: ReturnType<typeof within>, start: string, end: string) => {
  fireEvent.change(sheet.getByLabelText('From'), { target: { value: start } });
  fireEvent.change(sheet.getByLabelText('To'), { target: { value: end } });
};

describe('Report period sheet', () => {
  it('applies a quick pick to the report', async () => {
    const sheet = await openSheet();
    fireEvent.click(sheet.getByRole('button', { name: 'Last month' }));
    expect(sheet.getByRole('button', { name: 'Last month' }).getAttribute('aria-pressed')).toBe('true');
    expect(sheet.getByLabelText('From')).toHaveProperty('value', '2026-08-01');
    fireEvent.click(sheet.getByRole('button', { name: 'Apply period' }));
    expect(await screen.findByRole('region', { name: '1–31 August 2026' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Last month' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('steps a month tab back to an earlier month and stops at the current one', async () => {
    const sheet = await openSheet();
    fireEvent.click(sheet.getByRole('button', { name: 'Month' }));
    expect(sheet.getByRole('button', { name: 'Next month' })).toHaveProperty('disabled', true);
    fireEvent.click(sheet.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Previous month' }));
    expect(sheet.getByLabelText('From')).toHaveProperty('value', '2026-07-01');
    expect(sheet.getByLabelText('To')).toHaveProperty('value', '2026-07-31');
    fireEvent.click(sheet.getByRole('button', { name: 'Next month' }));
    expect(sheet.getByLabelText('From')).toHaveProperty('value', '2026-08-01');
  });

  it('previews days, entries and the opening balance of a custom range', async () => {
    const sheet = await openSheet();
    dates(sheet, '2026-09-02', '2026-09-24');
    expect(sheet.getByText('23 days · 4 entries · Opening Available €1,064.40')).toBeTruthy();
    expect(sheet.getByRole('button', { name: 'Custom' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('refuses a range that ends before it starts until it is fixed', async () => {
    const sheet = await openSheet();
    dates(sheet, '2026-09-10', '2026-09-01');
    expect(sheet.getByRole('alert').textContent).toContain('The start date must be on or before the end date');
    const apply = sheet.getByRole('button', { name: 'Apply period' });
    expect(apply).toHaveProperty('disabled', true);
    dates(sheet, '2026-09-01', '2026-09-10');
    expect(sheet.queryByRole('alert')).toBeNull();
    expect(apply).toHaveProperty('disabled', false);
    fireEvent.click(apply);
    expect(await screen.findByRole('region', { name: '1–10 September 2026' })).toBeTruthy();
  });

  it('leaves the report alone on Cancel', async () => {
    const sheet = await openSheet();
    fireEvent.click(sheet.getByRole('button', { name: 'Last year' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('region', { name: '1–24 September 2026' })).toBeTruthy();
  });
});

describe('Report period sheet before the entries are loaded', () => {
  it('shows no entry count while loading', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const sheet = within(screen.getByRole('dialog', { name: 'Report period' }));
    expect(sheet.queryByText(/0 entries/)).toBeNull();
    expect(sheet.queryByText(/Opening Available/)).toBeNull();
  });
});
