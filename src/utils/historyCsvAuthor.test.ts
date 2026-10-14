import { describe, expect, it } from 'vitest';
import type { Transaction } from '../db/database';
import { buildHistoryCsv } from './historyCsv';

const tx = (over: Partial<Transaction>): Transaction =>
  ({
    id: 't',
    type: 'inflow',
    amount: 10,
    date: '2026-03-01',
    account_id: 'cash',
    from_account_id: null,
    category: 'sales',
    notes: '',
    deleted: false,
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
    ...over,
  }) as Transaction;

describe('CSV author column', () => {
  it('T13 ends every row with who made the entry, "Unknown / N/A" when nobody is recorded', () => {
    const lines = buildHistoryCsv(
      [tx({ id: 'a', created_by: 'u1' } as Partial<Transaction>), tx({ id: 'b' }), tx({ id: 'c', created_by: 'gone' } as Partial<Transaction>)],
      undefined,
      { u1: 'Anna' },
    ).split('\n');
    expect(lines[0]).toBe('Date,In,Out,What,Balance,Prudent Reserve,Created by');
    expect(lines[1].endsWith(',"Anna"')).toBe(true);
    expect(lines[2].endsWith(',"Unknown / N/A"')).toBe(true);
    expect(lines[3].endsWith(',"Unknown / N/A"')).toBe(true);
  });

  it('T13b quotes author names that contain commas or quotes', () => {
    const csv = buildHistoryCsv([tx({ created_by: 'u1' } as Partial<Transaction>)], undefined, { u1: 'Anna, "A"' });
    expect(csv.split('\n')[1].endsWith(',"Anna, ""A"""')).toBe(true);
  });
});
