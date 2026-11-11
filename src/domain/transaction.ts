import { fromAccountLabel, getAccountLabel, type AccountId } from './accounts';
import { categoryLabel, parseAmount } from './recordForm';

export type TransactionType = 'inflow' | 'outflow' | 'transfer';
// 'delete' is only found on entries removed before removals carried a reason.
export type AuditAction = 'create' | 'update' | 'delete' | 'remove' | 'restore';

export const REMOVE_REASONS = ['Duplicate', 'Entered by mistake', 'Wrong account', 'Other'] as const;
export type RemoveReason = (typeof REMOVE_REASONS)[number];

export function isRemoveReason(value: string): value is RemoveReason {
  return REMOVE_REASONS.some((r) => r === value);
}

export const EDIT_REASONS = ['Wrong amount', 'Wrong account', 'Typo', 'Other'] as const;

export interface Transaction {
  id: string;
  wallet_id: string;
  type: TransactionType;
  amount: number;
  date: string;
  account_id: AccountId;
  from_account_id?: AccountId | null;
  category: string;
  notes: string;
  reason?: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  removed_reason?: string | null;
  removed_note?: string | null;
  removed_by?: string | null;
  removed_at?: string | null;
  /** Who made the entry (profile id); null for entries from before login existed. */
  created_by?: string | null;
  /** Role and name of the author as they were when the entry was made (kept if the account is removed). */
  created_by_role?: 'owner' | 'staff' | null;
  created_by_name?: string | null;
}

export interface AuditEntry {
  id: string;
  wallet_id: string;
  transaction_id: string;
  action: AuditAction;
  timestamp: string;
  previous_data?: Partial<Transaction> | null;
  new_data?: Partial<Transaction> | null;
  /** Display name of who made the change when it was recorded. */
  actor?: string | null;
  /** Who made the change (profile id); null for history from before login existed. */
  created_by?: string | null;
  created_by_role?: 'owner' | 'staff' | null;
  created_by_name?: string | null;
  reason?: string | null;
  note?: string | null;
}

/** Search matches category, notes or reason, ignoring case and surrounding spaces; an empty query matches all. */
export function matchesSearch(tx: Transaction, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [tx.category, tx.notes, tx.reason].some((field) => field?.toLowerCase().includes(q));
}

/** Entries that still count, and what came in and went out among them. */
export function historyTotals(txs: Transaction[]) {
  const live = txs.filter((t) => !t.deleted);
  const sum = (type: TransactionType) =>
    live.filter((t) => t.type === type).reduce((total, t) => total + Number(t.amount), 0);
  return { count: live.length, inflow: sum('inflow'), outflow: sum('outflow') };
}

/** "From → To" for a transfer, else the category; `fallback` when the category is empty. */
export function entryTitle(tx: Transaction, fallback: string): string {
  if (tx.type === 'transfer') return `${fromAccountLabel(tx)} → ${getAccountLabel(tx.account_id)}`;
  return categoryLabel(tx.category) || fallback;
}

export function auditEventTitle(action: AuditAction): string {
  if (action === 'create') return 'Created';
  if (action === 'update') return 'Edited';
  if (action === 'restore') return 'Restored';
  return 'Removed';
}

/** Owners remove any entry; staff only the ones they made (entries without a signed-in user stay open). */
export function canRemoveEntry({
  can,
  userId,
  tx,
}: {
  can: (action: string) => boolean;
  userId: string | undefined;
  tx: Pick<Transaction, 'created_by'>;
}): boolean {
  return can('remove_entry') || (can('remove_own_entry') && (!userId || tx.created_by === userId));
}

/** The message for an edit that can't be saved, or null. */
export function validateEntryEdit(tx: Pick<Transaction, 'amount' | 'notes'>, amountText: string, notes: string) {
  const amount = parseAmount(amountText);
  if (!(amount > 0)) return 'Enter an amount above zero, with up to two decimals';
  if (amount === Number(tx.amount) && notes.trim() === tx.notes) return 'Change the amount or the notes first';
  return null;
}
