import type { AccountId } from '../db/accounts';

export const DEFAULT_EXPENSE_ACCOUNT: AccountId = 'cash';

interface ExpenseForm {
  amount: string;
  date: string;
  accountId: AccountId;
  category: string;
  customCategory: string;
  notes: string;
}

export function buildExpenseInput(form: ExpenseForm) {
  const isOther = form.category === 'other';
  return {
    type: 'outflow' as const,
    amount: parseFloat(form.amount),
    date: form.date,
    account_id: form.accountId,
    from_account_id: null,
    category: isOther ? form.customCategory || 'other' : form.category,
    notes: form.notes,
    reason: isOther ? form.customCategory : null,
  };
}

/**
 * True if spending `amount` would leave `balance` below zero (compared in whole cents).
 * An unknown (`null`) balance never warns, so we don't cry wolf while balances load or if the fetch failed.
 */
export function wouldOverdraw(balance: number | null, amount: number): boolean {
  if (balance === null || !Number.isFinite(amount) || amount <= 0) return false;
  return Math.round((balance - amount) * 100) < 0;
}
