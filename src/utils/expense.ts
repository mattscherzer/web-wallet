import type { AccountId } from '../db/accounts';

/** Accounts an expense may be paid from. The prudent reserve is deliberately excluded. */
export const EXPENSE_ACCOUNT_IDS: AccountId[] = ['cash', 'paypal', 'bank'];

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

/** True if spending `amount` would leave `balance` below zero (compared in whole cents). */
export function wouldOverdraw(balance: number, amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  return Math.round((balance - amount) * 100) < 0;
}
