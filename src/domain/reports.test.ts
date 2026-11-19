import { describe, expect, it } from 'vitest';
import type { Transaction } from './transaction';
import {
  buildReport,
  parseDate,
  daysLabel,
  periodDays,
  periodKey,
  periodLabel,
  monthYearLabel,
  presetPeriod,
  shortDate,
  previousMonth,
  QUICK_PICKS,
  validatePeriod,
} from './reports';

let seq = 0;
function tx(overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'account_id'>): Transaction {
  seq += 1;
  return {
    id: `tx-${String(seq).padStart(4, '0')}`,
    wallet_id: 'w1',
    date: '2026-09-10',
    from_account_id: null,
    category: 'other',
    notes: '',
    reason: null,
    created_at: '2026-09-10T10:00:00Z',
    updated_at: '2026-09-10T10:00:00Z',
    deleted: false,
    ...overrides,
  };
}

const TODAY = '2026-09-24';
const SEPTEMBER = { start: '2026-09-01', end: '2026-09-24' };

describe('presetPeriod', () => {
  it('runs this month from the 1st to today', () => {
    expect(presetPeriod('month', 0, TODAY)).toEqual(SEPTEMBER);
  });

  it('gives whole months for earlier offsets, across a year boundary', () => {
    expect(presetPeriod('month', -1, TODAY)).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(presetPeriod('month', -1, '2026-01-15')).toEqual({ start: '2025-12-01', end: '2025-12-31' });
    expect(presetPeriod('month', -9, TODAY)).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });

  it('ends February on the 29th in a leap year and the 28th otherwise', () => {
    expect(presetPeriod('month', -1, '2028-03-10').end).toBe('2028-02-29');
    expect(presetPeriod('month', -1, '2026-03-10').end).toBe('2026-02-28');
  });

  it('handles month-end today dates', () => {
    expect(presetPeriod('month', 0, '2026-01-31')).toEqual({ start: '2026-01-01', end: '2026-01-31' });
    expect(presetPeriod('month', -1, '2026-03-31')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('snaps quarters to calendar quarters', () => {
    expect(presetPeriod('quarter', 0, TODAY)).toEqual({ start: '2026-07-01', end: TODAY });
    expect(presetPeriod('quarter', -1, TODAY)).toEqual({ start: '2026-04-01', end: '2026-06-30' });
    expect(presetPeriod('quarter', -1, '2026-02-10')).toEqual({ start: '2025-10-01', end: '2025-12-31' });
    expect(presetPeriod('quarter', 0, '2026-03-31')).toEqual({ start: '2026-01-01', end: '2026-03-31' });
  });

  it('gives this year to today and last year in full', () => {
    expect(presetPeriod('year', 0, TODAY)).toEqual({ start: '2026-01-01', end: TODAY });
    expect(presetPeriod('year', -1, TODAY)).toEqual({ start: '2025-01-01', end: '2025-12-31' });
  });

  it('offers the six quick picks from the design', () => {
    expect(QUICK_PICKS.map((p) => p.label)).toEqual([
      'This month',
      'Last month',
      'This quarter',
      'Last quarter',
      'This year',
      'Last year',
    ]);
    expect(QUICK_PICKS[1]?.period(TODAY)).toEqual({ start: '2026-08-01', end: '2026-08-31' });
  });

  it('refuses a today that is not a date', () => {
    expect(() => presetPeriod('month', 0, '2026-02-30')).toThrow();
  });
});

describe('validatePeriod', () => {
  it('accepts a single day and an ordinary range', () => {
    expect(validatePeriod({ start: '2026-09-01', end: '2026-09-01' })).toBeNull();
    expect(validatePeriod(SEPTEMBER)).toBeNull();
  });

  it('rejects an end before the start', () => {
    expect(validatePeriod({ start: '2026-09-02', end: '2026-09-01' })).toMatch(/on or before/);
  });

  it('rejects missing and impossible dates', () => {
    expect(validatePeriod({ start: '', end: '2026-09-01' })).not.toBeNull();
    expect(validatePeriod({ start: '2026-02-30', end: '2026-03-01' })).not.toBeNull();
    expect(validatePeriod({ start: '2026-9-1', end: '2026-09-01' })).not.toBeNull();
  });

  it('allows a custom end after today', () => {
    expect(validatePeriod({ start: '2026-09-01', end: '2027-01-01' })).toBeNull();
  });
});

describe('period labels', () => {
  it('writes a range inside one month with a dash', () => {
    expect(periodLabel(SEPTEMBER)).toBe('1–24 September 2026');
  });

  it('writes ranges across months and years in full', () => {
    expect(periodLabel({ start: '2026-08-01', end: '2026-09-24' })).toBe('1 August – 24 September 2026');
    expect(periodLabel({ start: '2025-12-01', end: '2026-01-24' })).toBe('1 December 2025 – 24 January 2026');
  });

  it('writes a single day without a range', () => {
    expect(periodLabel({ start: '2026-09-05', end: '2026-09-05' })).toBe('5 September 2026');
  });

  it('counts days inclusively, over a leap day too', () => {
    expect(periodDays(SEPTEMBER)).toBe(24);
    expect(periodDays({ start: '2028-02-28', end: '2028-03-01' })).toBe(3);
    expect(daysLabel(24)).toBe('24 days');
    expect(daysLabel(1)).toBe('1 day');
  });

  it('names a period inside one month by that month and others by their dates', () => {
    expect(periodKey(SEPTEMBER)).toBe('2026-09');
    expect(periodKey({ start: '2026-07-01', end: '2026-09-24' })).toBe('2026-07-01_2026-09-24');
  });
});

describe('buildReport', () => {
  const designExample = () => [
    tx({ type: 'inflow', amount: 1000, account_id: 'bank', date: '2026-08-15' }),
    tx({ type: 'inflow', amount: 64.4, account_id: 'cash', date: '2026-08-20' }),
    tx({ type: 'inflow', amount: 550, account_id: 'prudent_reserve', date: '2026-08-21' }),
    tx({ type: 'inflow', amount: 200.9, account_id: 'bank', date: '2026-09-03' }),
    tx({ type: 'inflow', amount: 95, account_id: 'paypal', date: '2026-09-05' }),
    tx({ type: 'outflow', amount: 100, account_id: 'cash', date: '2026-09-08' }),
    tx({ type: 'transfer', amount: 50, account_id: 'prudent_reserve', from_account_id: 'bank', date: '2026-09-12' }),
  ];

  it('reproduces the design example', () => {
    const report = buildReport(SEPTEMBER, designExample());
    expect(report).toMatchObject({
      openingAvailable: 106440,
      openingReserve: 55000,
      moneyIn: 29590,
      moneyOut: 10000,
      movedToReserve: 5000,
      closingAvailable: 121030,
      closingReserve: 60000,
      entryCount: 4,
    });
  });

  it('keeps opening + in - out - moved to reserve = closing', () => {
    const r = buildReport(SEPTEMBER, designExample());
    expect(r.openingAvailable + r.moneyIn - r.moneyOut - r.movedToReserve).toBe(r.closingAvailable);
  });

  it('lists entries chronologically with running Available and Reserve', () => {
    const r = buildReport(SEPTEMBER, designExample());
    expect(r.entries.map((e) => [e.entry.date, e.available, e.reserve])).toEqual([
      ['2026-09-03', 126530, 55000],
      ['2026-09-05', 136030, 55000],
      ['2026-09-08', 126030, 55000],
      ['2026-09-12', 121030, 60000],
    ]);
  });

  it('orders entries on the same day by creation time, whatever order they arrive in', () => {
    const later = tx({ type: 'inflow', amount: 5, account_id: 'cash', created_at: '2026-09-10T12:00:00Z' });
    const earlier = tx({ type: 'inflow', amount: 3, account_id: 'cash', created_at: '2026-09-10T09:00:00Z' });
    const r = buildReport(SEPTEMBER, [later, earlier]);
    expect(r.entries.map((e) => e.entry.id)).toEqual([earlier.id, later.id]);
  });

  it('leaves removed entries out of totals and balances but lists them apart', () => {
    const removed = tx({ type: 'inflow', amount: 999, account_id: 'cash', date: '2026-09-04', deleted: true });
    const before = tx({ type: 'inflow', amount: 999, account_id: 'cash', date: '2026-08-04', deleted: true });
    const r = buildReport(SEPTEMBER, [...designExample(), removed, before]);
    expect(r.openingAvailable).toBe(106440);
    expect(r.moneyIn).toBe(29590);
    expect(r.closingAvailable).toBe(121030);
    expect(r.entryCount).toBe(4);
    expect(r.removedEntries).toHaveLength(1);
    expect(r.removedEntries[0]).toMatchObject({ removed: true, available: 126530 });
    expect(r.entries.some((e) => e.entry.id === removed.id)).toBe(false);
  });

  it('does not change totals for transfers within Available or within the reserve', () => {
    const r = buildReport(SEPTEMBER, [
      tx({ type: 'inflow', amount: 100, account_id: 'cash', date: '2026-08-01' }),
      tx({ type: 'inflow', amount: 40, account_id: 'prudent_reserve', date: '2026-08-01' }),
      tx({ type: 'transfer', amount: 30, account_id: 'bank', from_account_id: 'cash' }),
    ]);
    expect(r).toMatchObject({
      moneyIn: 0,
      moneyOut: 0,
      movedToReserve: 0,
      closingAvailable: 10000,
      closingReserve: 4000,
    });
    expect(r.entryCount).toBe(1);
    expect(r.entries[0]).toMatchObject({ availableChange: 0, reserveChange: 0 });
  });

  it('counts a move out of the reserve as negative moved to reserve', () => {
    const r = buildReport(SEPTEMBER, [
      tx({ type: 'inflow', amount: 100, account_id: 'prudent_reserve', date: '2026-08-01' }),
      tx({ type: 'transfer', amount: 60, account_id: 'cash', from_account_id: 'prudent_reserve' }),
    ]);
    expect(r).toMatchObject({ movedToReserve: -6000, moneyIn: 0, closingAvailable: 6000, closingReserve: 4000 });
  });

  it('changes only the reserve for money paid in or out of it directly', () => {
    const r = buildReport(SEPTEMBER, [
      tx({ type: 'inflow', amount: 70, account_id: 'prudent_reserve' }),
      tx({ type: 'outflow', amount: 20, account_id: 'prudent_reserve', date: '2026-09-11' }),
    ]);
    expect(r).toMatchObject({ moneyIn: 0, moneyOut: 0, movedToReserve: 0, closingAvailable: 0, closingReserve: 5000 });
    expect(r.entryCount).toBe(2);
  });

  it('reports zeros and an empty list for a period with no entries', () => {
    const r = buildReport(SEPTEMBER, [tx({ type: 'inflow', amount: 12.34, account_id: 'cash', date: '2026-08-31' })]);
    expect(r).toMatchObject({ openingAvailable: 1234, closingAvailable: 1234, entryCount: 0, entries: [] });
  });

  it('includes entries on both boundary days and excludes the days around them', () => {
    const r = buildReport({ start: '2026-09-10', end: '2026-09-20' }, [
      tx({ type: 'inflow', amount: 1, account_id: 'cash', date: '2026-09-09' }),
      tx({ type: 'inflow', amount: 2, account_id: 'cash', date: '2026-09-10' }),
      tx({ type: 'inflow', amount: 4, account_id: 'cash', date: '2026-09-20' }),
      tx({ type: 'inflow', amount: 8, account_id: 'cash', date: '2026-09-21' }),
    ]);
    expect(r).toMatchObject({ openingAvailable: 100, moneyIn: 600, closingAvailable: 700, entryCount: 2 });
  });

  it('includes a leap day in a February period', () => {
    const r = buildReport(presetPeriod('month', -1, '2028-03-10'), [
      tx({ type: 'inflow', amount: 5, account_id: 'cash', date: '2028-02-29' }),
      tx({ type: 'inflow', amount: 7, account_id: 'cash', date: '2028-03-01' }),
    ]);
    expect(r.moneyIn).toBe(500);
  });

  it('stays exact in cents where floats drift', () => {
    const r = buildReport(SEPTEMBER, [
      tx({ type: 'inflow', amount: 0.1, account_id: 'cash' }),
      tx({ type: 'inflow', amount: 0.2, account_id: 'cash' }),
      tx({ type: 'inflow', amount: '1.15' as unknown as number, account_id: 'cash' }),
    ]);
    expect(r.moneyIn).toBe(145);
  });

  it('does not change the transactions it is given', () => {
    const input = designExample().reverse();
    const ids = input.map((t) => t.id);
    buildReport(SEPTEMBER, input);
    expect(input.map((t) => t.id)).toEqual(ids);
  });
});

describe('previousMonth', () => {
  it('gives the whole month before the period starts, across a year end and a leap day', () => {
    expect(previousMonth(SEPTEMBER)).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(previousMonth({ start: '2026-01-10', end: '2026-01-20' })).toEqual({
      start: '2025-12-01',
      end: '2025-12-31',
    });
    expect(previousMonth({ start: '2028-03-05', end: '2028-03-06' })).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
    expect(shortDate('2026-09-01')).toBe('1 Sep');
    expect(monthYearLabel({ start: '2026-08-01', end: '2026-08-31' })).toBe('August 2026');
  });
});

describe('parseDate years 0-99', () => {
  it('keeps the year instead of mapping it to 19xx', () => {
    expect(parseDate('0050-03-04')?.getUTCFullYear()).toBe(50);
    expect(parseDate('0050-02-30')).toBeNull();
    expect(validatePeriod({ start: '0050-03-04', end: '0050-03-05' })).toBeNull();
  });
});
