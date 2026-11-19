import type { Transaction } from './transaction';

export function whatText(tx: Transaction): string {
  let what = tx.category
    ? tx.category.charAt(0).toUpperCase() + tx.category.slice(1).replace(/-/g, ' ')
    : 'Transaction';
  if (!tx.notes) return what;
  if (tx.category && tx.category !== 'other' && tx.category !== 'transfer') what += ` - ${tx.notes}`;
  else what = tx.notes;
  return what;
}

export const quoted = (text: string) => `"${text.replace(/"/g, '""')}"`;

const FORMULA_START = /^[=+\-@\t\r]/;

/** Spreadsheets run text starting with these characters as formulas. */
export const csvText = (text: string) => quoted(FORMULA_START.test(text) ? `'${text}` : text);
