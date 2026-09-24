import { describe, expect, it } from 'vitest';
import type { Transaction } from '../db/database';
import { buildHistoryCsv, buildHistoryCsvRows, HISTORY_CSV_HEADER } from './historyCsv';

let seq = 0;
function tx(overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'account_id'>): Transaction {
  seq += 1;
  return {
    id: `tx-${seq}`,
    date: '2026-03-01',
    from_account_id: null,
    category: 'other',
    notes: '',
    reason: null,
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
    deleted: false,
    ...overrides,
  };
}

/** Pull out just the running-balance columns for readability. */
const balances = (rows: string[][]) => rows.slice(1).map((r) => [r[4], r[5]]);

describe('buildHistoryCsvRows', () => {
  it('starts with the header row', () => {
    expect(buildHistoryCsvRows([])).toEqual([HISTORY_CSV_HEADER]);
    expect(HISTORY_CSV_HEADER).toEqual(['Date', 'In', 'Out', 'What', 'Balance', 'Prudent Reserve']);
  });

  it('tracks main and reserve running balances over a known sequence', () => {
    const rows = buildHistoryCsvRows([
      tx({ type: 'inflow', amount: 1000, account_id: 'bank', date: '2026-01-05' }),
      tx({ type: 'inflow', amount: 50.5, account_id: 'cash', date: '2026-01-06' }),
      tx({ type: 'outflow', amount: 20.25, account_id: 'cash', date: '2026-01-07' }),
      tx({ type: 'transfer', amount: 300, account_id: 'prudent_reserve', from_account_id: 'bank', date: '2026-01-08' }),
      tx({ type: 'transfer', amount: 75, account_id: 'paypal', from_account_id: 'prudent_reserve', date: '2026-01-09' }),
      tx({ type: 'inflow', amount: 10, account_id: 'prudent_reserve', date: '2026-01-10' }),
      tx({ type: 'outflow', amount: 5, account_id: 'prudent_reserve', date: '2026-01-11' }),
    ]);

    // Hand-checked:
    //   main:    1000 → 1050.50 → 1030.25 → 730.25 → 805.25 → 805.25 → 805.25
    //   reserve:    0 →       0 →       0 →    300 →    225 →    235 →    230
    expect(balances(rows)).toEqual([
      ['1000.00', '+0.00'],
      ['1050.50', '+0.00'],
      ['1030.25', '+0.00'],
      ['730.25', '+300.00'],
      ['805.25', '+225.00'],
      ['805.25', '+235.00'],
      ['805.25', '+230.00'],
    ]);
  });

  it('shows in/out from the point of view of the main balance', () => {
    const rows = buildHistoryCsvRows([
      tx({ type: 'inflow', amount: 100, account_id: 'cash' }),
      tx({ type: 'outflow', amount: 40, account_id: 'cash' }),
      tx({ type: 'transfer', amount: 30, account_id: 'prudent_reserve', from_account_id: 'cash' }),
      tx({ type: 'transfer', amount: 10, account_id: 'cash', from_account_id: 'prudent_reserve' }),
      tx({ type: 'inflow', amount: 7, account_id: 'prudent_reserve' }),
      tx({ type: 'outflow', amount: 3, account_id: 'prudent_reserve' }),
    ]);

    expect(rows.slice(1).map((r) => [r[1], r[2]])).toEqual([
      ['100.00', ''],
      ['', '40.00'],
      ['', '30.00'], // leaving main for reserve
      ['10.00', ''], // entering main from reserve
      ['7.00', ''],
      ['', '3.00'],
    ]);
  });

  it('omits transfers between two main accounts', () => {
    const rows = buildHistoryCsvRows([
      tx({ type: 'inflow', amount: 200, account_id: 'bank' }),
      tx({ type: 'transfer', amount: 80, account_id: 'cash', from_account_id: 'bank' }),
      tx({ type: 'outflow', amount: 20, account_id: 'cash' }),
    ]);

    expect(rows).toHaveLength(3);
    expect(balances(rows)).toEqual([
      ['200.00', '+0.00'],
      ['180.00', '+0.00'],
    ]);
  });

  it('keeps a transfer with a null source as a row without moving any balance', () => {
    // Current behaviour, pinned so any change is deliberate (see #12).
    const rows = buildHistoryCsvRows([
      tx({ type: 'inflow', amount: 50, account_id: 'cash' }),
      tx({ type: 'transfer', amount: 25, account_id: 'cash', from_account_id: null, notes: 'Legacy' }),
    ]);

    expect(rows[2]).toEqual(['01.03.26', '', '', '"Legacy"', '50.00', '+0.00']);
  });

  it('skips soft-deleted transactions', () => {
    const rows = buildHistoryCsvRows([
      tx({ type: 'inflow', amount: 50, account_id: 'cash' }),
      tx({ type: 'inflow', amount: 999, account_id: 'cash', deleted: true }),
    ]);

    expect(balances(rows)).toEqual([['50.00', '+0.00']]);
  });

  it('rounds fractional running balances to cents', () => {
    const rows = buildHistoryCsvRows([
      tx({ type: 'inflow', amount: 0.1, account_id: 'cash' }),
      tx({ type: 'inflow', amount: 0.2, account_id: 'cash' }),
    ]);

    expect(balances(rows)).toEqual([
      ['0.10', '+0.00'],
      ['0.30', '+0.00'],
    ]);
  });

  it('formats the date as DD.MM.YY', () => {
    const [, row] = buildHistoryCsvRows([
      tx({ type: 'inflow', amount: 1, account_id: 'cash', date: '2026-12-31' }),
    ]);
    expect(row[0]).toBe('31.12.26');
  });

  it('builds the What column from category and notes, quoting and escaping it', () => {
    const rows = buildHistoryCsvRows([
      tx({ type: 'outflow', amount: 1, account_id: 'cash', category: 'office-supplies', notes: '' }),
      tx({ type: 'outflow', amount: 1, account_id: 'cash', category: 'rent', notes: 'March' }),
      tx({ type: 'outflow', amount: 1, account_id: 'cash', category: 'other', notes: 'Misc "stuff"' }),
      tx({ type: 'outflow', amount: 1, account_id: 'cash', category: '', notes: '' }),
    ]);

    expect(rows.slice(1).map((r) => r[3])).toEqual([
      '"Office supplies"',
      '"Rent - March"',
      '"Misc ""stuff"""',
      '"Transaction"',
    ]);
  });
});

describe('buildHistoryCsv', () => {
  it('joins rows with commas and newlines', () => {
    const csv = buildHistoryCsv([
      tx({ type: 'inflow', amount: 12.5, account_id: 'bank', category: 'donation', date: '2026-02-03' }),
    ]);

    expect(csv).toBe(
      'Date,In,Out,What,Balance,Prudent Reserve\n03.02.26,12.50,,"Donation",12.50,+0.00'
    );
  });
});
