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

const by = (name: string | null, role: string | null) =>
  ({ created_by_name: name, created_by_role: role, created_by: name ? 'u1' : null }) as Partial<Transaction>;

describe('CSV author column', () => {
  it('T13 ends every row with the stored name and role of who made the entry, "Unknown / N/A" for old entries', () => {
    const lines = buildHistoryCsv([
      tx({ id: 'a', ...by('Anna', 'staff') }),
      tx({ id: 'b', ...by('Olga', 'owner') }),
      tx({ id: 'c' }),
    ]).split('\n');
    expect(lines[0]).toBe('Date,In,Out,What,Balance,Prudent Reserve,Created by');
    expect(lines[1].endsWith(',"Anna (staff)"')).toBe(true);
    expect(lines[2].endsWith(',"Olga (owner)"')).toBe(true);
    expect(lines[3].endsWith(',"Unknown / N/A"')).toBe(true);
  });

  it('T13b quotes author names that contain commas or quotes', () => {
    const csv = buildHistoryCsv([tx({ ...by('Anna, "A"', 'staff') })]);
    expect(csv.split('\n')[1].endsWith(',"Anna, ""A"" (staff)"')).toBe(true);
  });
});
