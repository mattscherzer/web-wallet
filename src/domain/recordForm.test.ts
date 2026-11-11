import { describe, expect, it } from 'vitest';
import type { AccountId } from './accounts';

// Loaded dynamically so a missing module fails the assertion instead of crashing the file.
const mod = await import('./recordForm').catch(() => undefined);

function lib() {
  expect(mod, 'src/utils/recordForm.ts must exist').toBeDefined();
  return mod!;
}

type Form = Parameters<NonNullable<typeof mod>['validateRecord']>[0];

const base = (over: Partial<Form> = {}): Form => ({
  type: 'inflow',
  amount: '145,50',
  accountId: 'cash',
  fromAccountId: 'bank',
  category: '7th-tradition',
  description: '',
  date: '2026-10-07',
  ...over,
});

const fieldsOf = (form: Form) =>
  lib()
    .validateRecord(form)
    .map((e) => e.field);

const BALANCES: Record<AccountId, number> = { cash: 100, paypal: 0, bank: 802.5, prudent_reserve: 500 };

describe('validateRecord', () => {
  it('rejects a zero, negative or missing amount and accepts a comma decimal', () => {
    const { parseAmount } = lib();
    for (const amount of ['', '0', '0,00', '-5', 'abc']) {
      expect(fieldsOf(base({ amount })), amount).toContain('amount');
    }
    expect(fieldsOf(base({ amount: '12,50' }))).toEqual([]);
    expect(parseAmount('12,50')).toBe(12.5);
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount('abc')).toBeNaN();
    const errors = lib().validateRecord(base({ amount: '0' }));
    expect(errors[0].message).toMatch(/amount/i);
  });

  it('rejects a transfer from and to the same account', () => {
    expect(fieldsOf(base({ type: 'transfer', accountId: 'bank', fromAccountId: 'bank' }))).toEqual(['accountId']);
    expect(fieldsOf(base({ type: 'transfer', accountId: 'bank', fromAccountId: 'cash' }))).toEqual([]);
  });

  it('requires a description for Other and for every money out', () => {
    expect(fieldsOf(base({ type: 'outflow', category: 'rent', description: '' }))).toEqual(['description']);
    expect(fieldsOf(base({ type: 'outflow', category: 'rent', description: 'Hall rent' }))).toEqual([]);
    expect(fieldsOf(base({ type: 'inflow', category: 'other', description: '  ' }))).toEqual(['description']);
    expect(fieldsOf(base({ type: 'inflow', category: 'literature', description: '' }))).toEqual([]);
  });
});

describe('record preview and action', () => {
  it('previews balances after and says what the button will do', () => {
    const { recordPreview, recordActionLabel, availableDelta } = lib();

    const out = base({ type: 'outflow', amount: '60', accountId: 'bank', category: 'rent', description: 'Hall rent' });
    const p = recordPreview(out, BALANCES);
    expect(p.lines).toEqual([{ accountId: 'bank', after: 742.5 }]);
    expect(p.availableAfter).toBeCloseTo(842.5);
    expect(recordActionLabel(out, 'en')).toBe('Record −€60.00 from Bank Account');

    const inflow = base({ amount: '145,50', accountId: 'cash' });
    expect(recordActionLabel(inflow, 'en')).toBe('Record +€145.50 into Cash Balance');
    expect(recordPreview(inflow, BALANCES).availableAfter).toBeCloseTo(1048);

    // Operating -> reserve lowers Available; operating -> operating leaves it unchanged.
    const toReserve = base({ type: 'transfer', amount: '50', fromAccountId: 'bank', accountId: 'prudent_reserve' });
    expect(recordActionLabel(toReserve, 'en')).toBe('Record €50.00 from Bank Account to Prudent Reserve');
    const r = recordPreview(toReserve, BALANCES);
    expect(r.lines).toEqual([
      { accountId: 'bank', after: 752.5 },
      { accountId: 'prudent_reserve', after: 550 },
    ]);
    expect(r.availableAfter).toBeCloseTo(852.5);
    expect(availableDelta({ type: 'transfer', amount: 50, accountId: 'prudent_reserve', fromAccountId: 'bank' })).toBe(
      -50,
    );
    expect(availableDelta({ type: 'transfer', amount: 150, accountId: 'bank', fromAccountId: 'cash' })).toBe(0);
    expect(availableDelta({ type: 'inflow', amount: 10, accountId: 'cash', fromAccountId: null })).toBe(10);
    expect(availableDelta({ type: 'outflow', amount: 10, accountId: 'cash', fromAccountId: null })).toBe(-10);
  });
});

describe('initialRecordForm and switchRecordType', () => {
  it('starts money in on cash and a transfer on the bank with no category', () => {
    expect(lib().initialRecordForm('inflow', '2026-10-07')).toMatchObject({
      accountId: 'cash',
      category: '7th-tradition',
      date: '2026-10-07',
      amount: '',
    });
    expect(lib().initialRecordForm('transfer', '2026-10-07')).toMatchObject({ accountId: 'bank', category: '' });
  });

  it('resets the category and moves a transfer destination off its source, keeping what was typed', () => {
    const typed = base({ type: 'outflow', category: 'rent', amount: '5', accountId: 'paypal' });
    expect(lib().switchRecordType(typed, 'inflow')).toMatchObject({
      category: '7th-tradition',
      amount: '5',
      accountId: 'paypal',
    });
    expect(lib().switchRecordType({ ...typed, fromAccountId: 'cash' }, 'transfer')).toMatchObject({
      category: '',
      accountId: 'bank',
    });
    expect(lib().switchRecordType({ ...typed, fromAccountId: 'bank' }, 'transfer').accountId).toBe('cash');
  });
});

describe('descriptionLabel', () => {
  it('asks what money out was for, what Other money in was for, and otherwise offers notes', () => {
    expect(lib().descriptionLabel(base({ type: 'outflow' }))).toBe('Paid to or what for');
    expect(lib().descriptionLabel(base({ category: 'other' }))).toBe('What was it for?');
    expect(lib().descriptionLabel(base())).toBe('Notes (optional)');
    expect(lib().descriptionLabel(base({ type: 'transfer', category: '' }))).toBe('Notes (optional)');
  });
});
