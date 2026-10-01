import { describe, expect, it } from 'vitest';
import { computeAccountBalances, type BalanceInput } from './balances';

const inflow = (account_id: BalanceInput['account_id'], amount: number | string): BalanceInput => ({
  type: 'inflow',
  amount,
  account_id,
});
const outflow = (account_id: BalanceInput['account_id'], amount: number | string): BalanceInput => ({
  type: 'outflow',
  amount,
  account_id,
});
const transfer = (
  from_account_id: BalanceInput['from_account_id'],
  account_id: BalanceInput['account_id'],
  amount: number | string
): BalanceInput => ({ type: 'transfer', amount, account_id, from_account_id });

describe('computeAccountBalances', () => {
  it('returns zero for every account when there are no transactions', () => {
    expect(computeAccountBalances([])).toEqual({
      cash: 0,
      paypal: 0,
      bank: 0,
      prudent_reserve: 0,
    });
  });

  it('adds inflows and subtracts outflows on the named account', () => {
    const balances = computeAccountBalances([
      inflow('cash', 100),
      inflow('bank', 250),
      outflow('cash', 30),
      outflow('paypal', 12),
    ]);

    expect(balances).toEqual({ cash: 70, paypal: -12, bank: 250, prudent_reserve: 0 });
  });

  it('moves money between main accounts without changing their combined total', () => {
    const balances = computeAccountBalances([
      inflow('bank', 500),
      transfer('bank', 'cash', 120),
    ]);

    expect(balances).toEqual({ cash: 120, paypal: 0, bank: 380, prudent_reserve: 0 });
  });

  it('moves money from a main account into the reserve', () => {
    const balances = computeAccountBalances([
      inflow('bank', 1000),
      transfer('bank', 'prudent_reserve', 300),
    ]);

    expect(balances).toEqual({ cash: 0, paypal: 0, bank: 700, prudent_reserve: 300 });
  });

  it('moves money from the reserve back into a main account', () => {
    const balances = computeAccountBalances([
      inflow('bank', 1000),
      transfer('bank', 'prudent_reserve', 300),
      transfer('prudent_reserve', 'cash', 50),
    ]);

    expect(balances).toEqual({ cash: 50, paypal: 0, bank: 700, prudent_reserve: 250 });
  });

  it('ignores soft-deleted transactions', () => {
    const balances = computeAccountBalances([
      inflow('cash', 100),
      { ...inflow('cash', 999), deleted: true },
      { ...transfer('cash', 'prudent_reserve', 40), deleted: true },
      { ...inflow('bank', 5), deleted: false },
    ]);

    expect(balances).toEqual({ cash: 100, paypal: 0, bank: 5, prudent_reserve: 0 });
  });

  it('treats zero-amount transactions as no-ops', () => {
    const balances = computeAccountBalances([
      inflow('cash', 0),
      outflow('bank', 0),
      transfer('bank', 'prudent_reserve', 0),
    ]);

    expect(balances).toEqual({ cash: 0, paypal: 0, bank: 0, prudent_reserve: 0 });
  });

  it('handles fractional amounts to the cent', () => {
    const balances = computeAccountBalances([
      inflow('cash', 0.1),
      inflow('cash', 0.2),
      outflow('cash', 0.05),
      transfer('cash', 'prudent_reserve', 0.15),
    ]);

    expect(balances.cash).toBeCloseTo(0.1, 10);
    expect(balances.prudent_reserve).toBeCloseTo(0.15, 10);
  });

  it('coerces numeric strings from the database to numbers', () => {
    const balances = computeAccountBalances([inflow('cash', '10.50'), outflow('cash', '0.25')]);

    expect(balances.cash).toBeCloseTo(10.25, 10);
  });

  it('credits only the destination when a transfer has a null source', () => {
    // Current behaviour, pinned so any change is deliberate (see #12).
    const balances = computeAccountBalances([
      transfer(null, 'cash', 40),
      transfer(undefined, 'prudent_reserve', 10),
    ]);

    expect(balances).toEqual({ cash: 40, paypal: 0, bank: 0, prudent_reserve: 10 });
  });

  it('does not mutate the input or share state between calls', () => {
    const txs = [inflow('cash', 10)];
    const first = computeAccountBalances(txs);
    first.cash = 9999;

    expect(computeAccountBalances(txs).cash).toBe(10);
    expect(txs).toEqual([inflow('cash', 10)]);
  });
});
