import type { AccountId } from './accounts';

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
