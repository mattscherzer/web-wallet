import { describe, expect, it } from 'vitest';
import {
  auditEventTitle,
  canRemoveEntry,
  entryTitle,
  historyTotals,
  matchesSearch,
  validateEntryEdit,
  type Transaction,
} from './transaction';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: '1',
  wallet_id: 'w',
  type: 'outflow',
  amount: 10,
  date: '2026-10-07',
  account_id: 'cash',
  category: 'rent',
  notes: 'Hall',
  created_at: 't',
  updated_at: 't',
  deleted: false,
  ...over,
});

describe('matchesSearch', () => {
  it('matches category, notes and reason, ignoring case and surrounding spaces', () => {
    expect(matchesSearch(tx(), '  HALL ')).toBe(true);
    expect(matchesSearch(tx(), 'rent')).toBe(true);
    expect(matchesSearch(tx({ reason: 'Because' }), 'becau')).toBe(true);
    expect(matchesSearch(tx(), 'nothing')).toBe(false);
  });
  it('matches everything for a blank query', () => {
    expect(matchesSearch(tx(), '   ')).toBe(true);
  });
});

describe('historyTotals', () => {
  it('counts and sums entries that were not removed', () => {
    const list = [
      tx({ type: 'inflow', amount: 20 }),
      tx({ type: 'outflow', amount: 5 }),
      tx({ type: 'outflow', amount: 7 }),
      tx({ type: 'transfer', amount: 100 }),
      tx({ type: 'inflow', amount: 99, deleted: true }),
    ];
    expect(historyTotals(list)).toEqual({ count: 4, inflow: 20, outflow: 12 });
  });
});

describe('entryTitle', () => {
  it('names a transfer by its accounts, else the category, else the fallback', () => {
    expect(entryTitle(tx({ type: 'transfer', from_account_id: 'cash', account_id: 'bank' }), 'x')).toBe(
      'Cash Balance → Bank Account',
    );
    expect(entryTitle(tx({ category: '7th-tradition' }), 'x')).toBe('7th Tradition');
    expect(entryTitle(tx({ category: '' }), 'Entry')).toBe('Entry');
  });
});

describe('auditEventTitle', () => {
  it('titles each action', () => {
    expect(['create', 'update', 'restore', 'remove', 'delete'].map((a) => auditEventTitle(a as never))).toEqual([
      'Created',
      'Edited',
      'Restored',
      'Removed',
      'Removed',
    ]);
  });
});

describe('canRemoveEntry', () => {
  const can =
    (...allowed: string[]) =>
    (a: string) =>
      allowed.includes(a);
  it('lets owners remove anything and staff only their own entries', () => {
    expect(canRemoveEntry({ can: can('remove_entry'), userId: 'u', tx: tx({ created_by: 'other' }) })).toBe(true);
    expect(canRemoveEntry({ can: can('remove_own_entry'), userId: 'u', tx: tx({ created_by: 'u' }) })).toBe(true);
    expect(canRemoveEntry({ can: can('remove_own_entry'), userId: 'u', tx: tx({ created_by: 'other' }) })).toBe(false);
    expect(canRemoveEntry({ can: can(), userId: 'u', tx: tx({ created_by: 'u' }) })).toBe(false);
  });
  it('leaves entries open when nobody is signed in', () => {
    expect(canRemoveEntry({ can: can('remove_own_entry'), userId: undefined, tx: tx({ created_by: 'o' }) })).toBe(true);
  });
});

describe('validateEntryEdit', () => {
  it('asks for a valid amount, then for an actual change', () => {
    expect(validateEntryEdit(tx(), '0', 'Hall')).toMatch(/above zero/);
    expect(validateEntryEdit(tx(), '10', ' Hall ')).toMatch(/Change the amount/);
    expect(validateEntryEdit(tx(), '12,5', 'Hall')).toBeNull();
    expect(validateEntryEdit(tx(), '10', 'Hall 2')).toBeNull();
  });
});
