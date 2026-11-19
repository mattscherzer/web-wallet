// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase';
import { asAuth, reportRows, TODAY, withOwnerConfirm } from '../test/reportsTestKit';
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

let blobs: Blob[];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
  ref.fake = createFakeSupabase(reportRows({ removed: true }));
  blobs = [];
  URL.createObjectURL = (b: Blob | MediaSource) => {
    blobs.push(b as Blob);
    return 'blob:test';
  };
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const page = (opts: { can?: (a: string) => boolean; confirm?: () => Promise<boolean> } = {}) =>
  render(
    asAuth(
      opts.can ?? (() => true),
      withOwnerConfirm(opts.confirm ?? (async () => true), walletApp(<ReportsPage />, { current: 'wb' })),
    ),
  );
const openExport = async () => {
  await screen.findByRole('region', { name: '1–24 September 2026' });
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  return within(screen.getByRole('dialog', { name: 'Export report' }));
};

describe('Report export sheet', () => {
  it('is not offered to people who may not export', async () => {
    page({ can: (action) => action !== 'export' });
    await screen.findByRole('region', { name: '1–24 September 2026' });
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export options' })).toBeNull();
  });

  it('opens from the share button and the more-options chevron too', async () => {
    page();
    await screen.findByRole('region', { name: '1–24 September 2026' });
    fireEvent.click(screen.getByRole('button', { name: 'Export options' }));
    expect(screen.getByRole('dialog', { name: 'Export report' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: /More export options/ }));
    expect(screen.getByRole('dialog', { name: 'Export report' })).toBeTruthy();
  });

  it('shows the period, the file name and a PDF choice that is not available yet', async () => {
    page();
    const sheet = await openExport();
    expect(sheet.getByText('1–24 September 2026')).toBeTruthy();
    expect(sheet.getByText('spring-convention-2027_2026-09.csv')).toBeTruthy();
    expect(sheet.getByRole('radio', { name: /CSV spreadsheet/ })).toHaveProperty('checked', true);
    expect(sheet.getByRole('radio', { name: /PDF to print or share/ })).toHaveProperty('disabled', true);
  });

  it('goes back to the export after the period is changed', async () => {
    page();
    const sheet = await openExport();
    fireEvent.click(sheet.getByRole('button', { name: 'Change' }));
    const periodSheet = within(screen.getByRole('dialog', { name: 'Report period' }));
    fireEvent.click(periodSheet.getByRole('button', { name: 'Last month' }));
    fireEvent.click(periodSheet.getByRole('button', { name: 'Apply period' }));
    const back = within(screen.getByRole('dialog', { name: 'Export report' }));
    expect(back.getByText('spring-convention-2027_2026-08.csv')).toBeTruthy();
  });

  it('downloads the report and closes the sheet', async () => {
    page();
    const sheet = await openExport();
    fireEvent.click(sheet.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    const text = await blobs[0].text();
    expect(text.split('\n')[0]).toBe('Wallet,"Spring Convention 2027"');
    expect(text).toContain('Opening balance');
    expect(text).not.toContain('Removed');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('adds removed entries only when the switch is on', async () => {
    page();
    const sheet = await openExport();
    const toggle = sheet.getByRole('switch', { name: 'Include removed entries' });
    expect(toggle).toHaveProperty('checked', false);
    fireEvent.click(toggle);
    expect(toggle).toHaveProperty('checked', true);
    fireEvent.click(sheet.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    expect(await blobs[0].text()).toContain('Removed');
  });

  it('downloads nothing and stays open when the owner does not confirm', async () => {
    const confirm = vi.fn(async () => false);
    page({ confirm });
    const sheet = await openExport();
    fireEvent.click(sheet.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(blobs).toHaveLength(0);
    expect(screen.getByRole('dialog', { name: 'Export report' })).toBeTruthy();
    expect(sheet.getByRole('button', { name: 'Export CSV' })).toHaveProperty('disabled', false);
  });

  it('shows an inline error when the export fails and clears it on the next attempt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    page();
    const sheet = await openExport();
    ref.fake.failNext('transactions:select', { message: 'offline' });
    fireEvent.click(sheet.getByRole('button', { name: 'Export CSV' }));
    expect((await sheet.findByRole('alert')).textContent).toBe(
      'Couldn’t export the report. Check your connection and try again.',
    );
    expect(blobs).toHaveLength(0);
    fireEvent.click(sheet.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  const press = (el: HTMLElement) => {
    el.focus();
    fireEvent.click(el);
  };

  it('keeps the removed-entries switch and returns focus to Export CSV after the period detour', async () => {
    page();
    await screen.findByRole('region', { name: '1–24 September 2026' });
    press(screen.getByRole('button', { name: 'Export CSV' }));
    let sheet = within(screen.getByRole('dialog', { name: 'Export report' }));
    fireEvent.click(sheet.getByRole('switch', { name: 'Include removed entries' }));
    press(sheet.getByRole('button', { name: 'Change' }));
    press(screen.getByRole('button', { name: 'Cancel' }));
    sheet = within(screen.getByRole('dialog', { name: 'Export report' }));
    expect(sheet.getByRole('switch', { name: 'Include removed entries' })).toHaveProperty('checked', true);
    press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Export CSV' }));
  });
});
