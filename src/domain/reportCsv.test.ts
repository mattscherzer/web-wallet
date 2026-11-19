import { describe, expect, it } from 'vitest';
import { buildReportCsv, REPORT_CSV_HEADER, reportFilename, slugify } from './reportCsv';
import { buildReport } from './reports';
import type { Transaction } from './transaction';

let seq = 0;
function tx(overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'account_id'>): Transaction {
  seq += 1;
  return {
    id: `tx-${String(seq).padStart(4, '0')}`,
    wallet_id: 'w1',
    date: '2026-09-10',
    from_account_id: null,
    category: overrides.type === 'transfer' ? 'transfer' : 'other',
    notes: '',
    reason: null,
    created_at: '2026-09-10T10:00:00Z',
    updated_at: '2026-09-10T10:00:00Z',
    deleted: false,
    ...overrides,
  };
}

const SEPTEMBER = { start: '2026-09-01', end: '2026-09-24' };

const sample = () => [
  tx({ type: 'inflow', amount: 100, account_id: 'bank', date: '2026-08-20' }),
  tx({ type: 'inflow', amount: 20, account_id: 'cash', date: '2026-09-03', category: 'sales', notes: 'Market' }),
  tx({ type: 'transfer', amount: 5, account_id: 'prudent_reserve', from_account_id: 'bank', date: '2026-09-05' }),
  tx({
    type: 'outflow',
    amount: 12.5,
    account_id: 'cash',
    date: '2026-09-06',
    created_by_name: 'Ana',
    created_by_role: 'staff',
  }),
];

const lines = (csv: string) => csv.split('\n');

describe('buildReportCsv', () => {
  it('writes wallet, period, header, opening row, entries and totals', () => {
    const csv = lines(buildReportCsv(buildReport(SEPTEMBER, sample()), 'Corner Shop'));
    expect(csv[0]).toBe('Wallet,"Corner Shop"');
    expect(csv[1]).toBe('Period,2026-09-01 to 2026-09-24');
    expect(csv[2]).toBe(REPORT_CSV_HEADER.join(','));
    expect(csv[2]).toBe(
      'Date,Description,Money in,Money out,Moved to reserve,Available balance,Reserve balance,Created by',
    );
    expect(csv[3]).toBe('2026-09-01,"Opening balance",,,,100.00,0.00,');
    expect(csv[4]).toBe('2026-09-03,"Sales - Market",20.00,,,120.00,0.00,"Unknown / N/A"');
    expect(csv[5]).toBe('2026-09-05,"Transfer",,,5.00,115.00,5.00,"Unknown / N/A"');
    expect(csv[6]).toBe('2026-09-06,"Other",,12.50,,102.50,5.00,"Ana (staff)"');
    expect(csv[7]).toBe(',"Totals",20.00,12.50,5.00,102.50,5.00,');
    expect(csv).toHaveLength(8);
  });

  it('writes an empty period as opening and totals rows only', () => {
    const csv = lines(buildReportCsv(buildReport(SEPTEMBER, []), 'W'));
    expect(csv.slice(3)).toEqual(['2026-09-01,"Opening balance",,,,0.00,0.00,', ',"Totals",0.00,0.00,0.00,0.00,0.00,']);
  });

  it('leaves removed entries out unless asked, then marks them and keeps balances and totals', () => {
    const removed = tx({
      type: 'outflow',
      amount: 99,
      account_id: 'cash',
      date: '2026-09-04',
      deleted: true,
      notes: 'Oops',
    });
    const report = buildReport(SEPTEMBER, [...sample(), removed]);
    expect(buildReportCsv(report, 'W')).not.toContain('Oops');

    const csv = lines(buildReportCsv(report, 'W', true));
    expect(csv[5]).toBe('2026-09-04,"Removed: Oops",,99.00,,120.00,0.00,"Unknown / N/A"');
    expect(csv[csv.length - 1]).toBe(',"Totals",20.00,12.50,5.00,102.50,5.00,');
  });

  it('shows a move out of the reserve as a negative move and a direct reserve entry only in the balance', () => {
    const csv = lines(
      buildReportCsv(
        buildReport(SEPTEMBER, [
          tx({ type: 'inflow', amount: 50, account_id: 'prudent_reserve', date: '2026-08-01' }),
          tx({ type: 'transfer', amount: 20, account_id: 'cash', from_account_id: 'prudent_reserve' }),
          tx({ type: 'inflow', amount: 3, account_id: 'prudent_reserve', date: '2026-09-11' }),
        ]),
        'W',
      ),
    );
    expect(csv[4]).toBe('2026-09-10,"Transfer",,,-20.00,20.00,30.00,"Unknown / N/A"');
    expect(csv[5]).toBe('2026-09-11,"Other",,,,20.00,33.00,"Unknown / N/A"');
  });

  it('keeps a transfer within Available as an entry with no money columns', () => {
    const csv = lines(
      buildReportCsv(
        buildReport(SEPTEMBER, [tx({ type: 'transfer', amount: 9, account_id: 'bank', from_account_id: 'cash' })]),
        'W',
      ),
    );
    expect(csv[4]).toBe('2026-09-10,"Transfer",,,,0.00,0.00,"Unknown / N/A"');
  });

  it('defuses spreadsheet formulas in the wallet name, notes and author', () => {
    const entry = tx({
      type: 'inflow',
      amount: 1,
      account_id: 'cash',
      category: 'other',
      notes: '=HYPERLINK("http://evil")',
      created_by_name: '@bob',
    });
    const csv = lines(buildReportCsv(buildReport(SEPTEMBER, [entry]), '+cmd'));
    expect(csv[0]).toBe(`Wallet,"'+cmd"`);
    expect(csv[4]).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv[4]).toContain(`"'@bob"`);
  });
});

describe('totals row', () => {
  it('reconciles: opening + in - out - moved = closing', () => {
    const csv = lines(buildReportCsv(buildReport(SEPTEMBER, sample()), 'W'));
    const [, , inn, out, moved, closing] = csv[csv.length - 1].split(',').map(Number);
    const opening = Number(csv[3].split(',')[5]);
    expect(opening + inn - out - moved).toBeCloseTo(closing, 2);
  });
});

describe('reportFilename', () => {
  it('slugs the wallet name and appends the month', () => {
    expect(reportFilename('Café Müller & Sons!', { period: SEPTEMBER })).toBe('cafe-muller-sons_2026-09.csv');
  });

  it('spells out a period that spans months', () => {
    expect(reportFilename('Shop', { period: { start: '2026-07-01', end: '2026-09-24' } })).toBe(
      'shop_2026-07-01_2026-09-24.csv',
    );
  });

  it('caps a very long wallet name so the filename stays usable', () => {
    expect(slugify(`${'ab '.repeat(40)}`).length).toBeLessThanOrEqual(40);
    expect(slugify(`${'ab '.repeat(40)}`)).not.toMatch(/-$/);
  });

  it('falls back to "wallet" when the name has no letters or digits', () => {
    expect(slugify('***')).toBe('wallet');
    expect(slugify('')).toBe('wallet');
  });
});
