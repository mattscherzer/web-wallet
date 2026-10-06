// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, twoWalletRows, type FakeSupabase } from '../test/fakeSupabase';
import { generateHistoryCsv } from './exportCsv';

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
afterEach(() => vi.restoreAllMocks());

describe('CSV download', () => {
  it('contains the wallet name on the first line and only that wallet’s entries', async () => {
    await generateHistoryCsv('wb', 'Spring Convention 2027');
    const text = await blobs[0].text();
    expect(text.split('\n')[0]).toBe('Wallet,"Spring Convention 2027"');
    expect(text).toContain('b1');
    expect(text).not.toMatch(/a1|a2|a3/);
  });
});
