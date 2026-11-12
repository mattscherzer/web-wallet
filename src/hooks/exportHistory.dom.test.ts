// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { exportHistory } from './exportHistory';

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
  ref.fake = createFakeSupabase(twoWalletRows());
  blobs = [];
  URL.createObjectURL = (b: Blob | MediaSource) => {
    blobs.push(b as Blob);
    return 'blob:test';
  };
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('CSV download', () => {
  it('contains the wallet name on the first line and only that wallet’s entries', async () => {
    await exportHistory('wb', 'Spring Convention 2027');
    const text = await blobs[0].text();
    expect(text.split('\n')[0]).toBe('Wallet,"Spring Convention 2027"');
    expect(text).toContain('b1');
    expect(text).not.toMatch(/a1|a2|a3/);
  });

  it('rejects and downloads nothing when the entries cannot be fetched', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    ref.fake.failNext('transactions:select', { message: 'offline' });
    await expect(exportHistory('wb', 'Spring Convention 2027')).rejects.toBeDefined();
    expect(blobs).toHaveLength(0);
  });

  it('includes every entry of a wallet with more than 1000', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({
      id: `m${i}`,
      wallet_id: 'wb',
      type: 'inflow',
      amount: 1,
      date: '2026-04-01',
      account_id: 'bank',
      from_account_id: null,
      category: 'sales',
      notes: `n${i}`,
      deleted: false,
      created_at: new Date(Date.UTC(2026, 3, 1, 0, 0, i)).toISOString(),
    }));
    ref.fake = createFakeSupabase({ ...twoWalletRows(), transactions: rows });
    await exportHistory('wb', 'Spring Convention 2027');
    const text = await blobs[0].text();
    expect(text).toContain('n1000');
  });
});
