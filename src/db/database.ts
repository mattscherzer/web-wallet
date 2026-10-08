import { supabase } from './supabase';
import type { AccountId } from './accounts';

export type { AccountId, Account } from './accounts';

// ─── Types ──────────────────────────────────────────────
export type TransactionType = 'inflow' | 'outflow' | 'transfer';
// 'delete' is only found on entries removed before removals carried a reason.
export type AuditAction = 'create' | 'update' | 'delete' | 'remove' | 'restore';

export const REMOVE_REASONS = ['Duplicate', 'Entered by mistake', 'Wrong account', 'Other'] as const;
export type RemoveReason = (typeof REMOVE_REASONS)[number];

function isRemoveReason(value: string): value is RemoveReason {
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
}

export interface AuditEntry {
  id: string;
  wallet_id: string;
  transaction_id: string;
  action: AuditAction;
  timestamp: string;
  previous_data?: Partial<Transaction> | null;
  new_data?: Partial<Transaction> | null;
  /** Who made the change; empty until sign-in exists. */
  actor?: string | null;
  reason?: string | null;
  note?: string | null;
}

// ─── Static Account Data ────────────────────────────────
export { ACCOUNTS, MAIN_ACCOUNTS, RESERVE_ACCOUNTS, getAccountLabel, fromAccountLabel } from './accounts';

// ─── Fetch PIN from Supabase ────────────────────────────
export async function fetchPin(): Promise<string> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'pin')
    .single();

  if (error || !data) {
    console.error('Failed to fetch PIN, falling back to default:', error);
    return '1234';
  }
  return data.value;
}

// ─── Create Transaction (inflow / outflow) ──────────────
export async function createTransaction(
  data: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'deleted'>,
  actor?: string
): Promise<string> {
  const { data: inserted, error } = await supabase
    .from('transactions')
    .insert({
      wallet_id: data.wallet_id,
      type: data.type,
      amount: data.amount,
      date: data.date,
      account_id: data.account_id,
      from_account_id: data.from_account_id || null,
      category: data.category,
      notes: data.notes,
      reason: data.reason || null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create transaction: ${error.message}`);

  const id = inserted.id;

  const { error: logError } = await supabase.from('audit_log').insert({
    wallet_id: data.wallet_id,
    transaction_id: id,
    action: 'create' as AuditAction,
    timestamp: new Date().toISOString(),
    actor: actor ?? null,
    new_data: { ...data, id },
  });

  if (logError) {
    // An entry without a history row must not be left behind.
    const { error: rollbackError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('wallet_id', data.wallet_id);
    if (rollbackError) console.error('Could not remove entry after a history failure', rollbackError);
    throw new Error(`Failed to create transaction: ${logError.message}`);
  }

  return id;
}

// ─── Create Transfer (between accounts) ─────────────────
export async function createTransfer(data: {
  wallet_id: string;
  amount: number;
  date: string;
  from_account_id: AccountId;
  account_id: AccountId;
  notes: string;
}): Promise<string> {
  return createTransaction({
    wallet_id: data.wallet_id,
    type: 'transfer',
    amount: data.amount,
    date: data.date,
    account_id: data.account_id,
    from_account_id: data.from_account_id,
    category: 'transfer',
    notes: data.notes,
    reason: null,
  });
}

// ─── Update Transaction ─────────────────────────────────
export async function updateTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'created_at' | 'deleted'>>,
  meta: { walletId?: string; reason?: string; actor?: string } = {}
): Promise<void> {
  let lookup = supabase.from('transactions').select('*').eq('id', id);
  if (meta.walletId) lookup = lookup.eq('wallet_id', meta.walletId);
  const { data: existing, error: fetchError } = await lookup.single();

  if (fetchError || !existing) throw new Error('Transaction not found');

  const previous = { ...existing };
  const now = new Date().toISOString();
  const updateData = { ...updates, updated_at: now };

  const { data: updated, error } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', id)
    .eq('wallet_id', existing.wallet_id)
    .eq('deleted', false)
    .select('id');

  if (error) throw new Error(`Failed to update transaction: ${error.message}`);
  if (!updated || updated.length === 0) throw new Error('Entry not found or removed');

  const { error: logError } = await supabase.from('audit_log').insert({
    wallet_id: existing.wallet_id,
    transaction_id: id,
    action: 'update' as AuditAction,
    timestamp: now,
    previous_data: previous,
    new_data: { ...previous, ...updateData },
    reason: meta.reason ?? null,
    actor: meta.actor ?? null,
  });

  if (logError) {
    // An edit is never kept without its history: put the old values back.
    const original = Object.fromEntries(Object.entries(previous).filter(([key]) => key in updateData));
    const { error: rollbackError } = await supabase
      .from('transactions')
      .update(original)
      .eq('id', id)
      .eq('wallet_id', existing.wallet_id);
    if (rollbackError) console.error('Could not undo edit after a history failure', rollbackError);
    throw new Error(`Failed to update transaction: ${logError.message}`);
  }
}

// ─── Soft-remove / restore ──────────────────────────────
// A removed entry stays in the books, marked removed, and stops counting in balances.
// The change history is written after the change; if it can't be written the change is undone,
// so an entry is never removed or restored without a trace.
export async function removeTransaction(
  id: string,
  { walletId, reason, note, actor }: { walletId: string; reason: string; note?: string; actor?: string }
): Promise<void> {
  if (!isRemoveReason(reason)) throw new Error('A reason is required');

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('transactions')
    .update({
      deleted: true,
      removed_reason: reason,
      removed_note: note?.trim() || null,
      removed_by: actor ?? null,
      removed_at: now,
    })
    .eq('id', id)
    .eq('wallet_id', walletId)
    .eq('deleted', false)
    .select('id');

  if (error) throw new Error(`Failed to remove transaction: ${error.message}`);
  if (!data || data.length === 0) throw new Error('Entry not found or already removed');

  const { error: logError } = await supabase.from('audit_log').insert({
    wallet_id: walletId,
    transaction_id: id,
    action: 'remove' as AuditAction,
    timestamp: now,
    reason,
    note: note?.trim() || null,
    actor: actor ?? null,
  });

  if (logError) {
    const { error: rollbackError } = await supabase
      .from('transactions')
      .update({ deleted: false, removed_reason: null, removed_note: null, removed_by: null, removed_at: null })
      .eq('id', id)
      .eq('wallet_id', walletId);
    if (rollbackError) console.error('Could not undo removal after a history failure', rollbackError);
    throw new Error(`Failed to remove transaction: ${logError.message}`);
  }
}

export async function restoreTransaction(
  id: string,
  { walletId, actor }: { walletId: string; actor?: string }
): Promise<void> {
  const { data: removed, error: lookupError } = await supabase
    .from('transactions')
    .select('removed_reason, removed_note, removed_by, removed_at')
    .eq('id', id)
    .eq('wallet_id', walletId)
    .eq('deleted', true)
    .single();

  // Without this snapshot a failed history write could not put the removal back as it was.
  if (lookupError) throw new Error(`Failed to restore transaction: ${lookupError.message}`);
  if (!removed) throw new Error('Entry not found or not removed');

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('transactions')
    .update({ deleted: false, removed_reason: null, removed_note: null, removed_by: null, removed_at: null })
    .eq('id', id)
    .eq('wallet_id', walletId)
    .eq('deleted', true)
    .select('id');

  if (error) throw new Error(`Failed to restore transaction: ${error.message}`);
  if (!data || data.length === 0) throw new Error('Entry not found or not removed');

  const { error: logError } = await supabase.from('audit_log').insert({
    wallet_id: walletId,
    transaction_id: id,
    action: 'restore' as AuditAction,
    timestamp: now,
    actor: actor ?? null,
  });

  if (logError) {
    const { error: rollbackError } = await supabase
      .from('transactions')
      .update({ deleted: true, ...removed })
      .eq('id', id)
      .eq('wallet_id', walletId);
    if (rollbackError) console.error('Could not undo restore after a history failure', rollbackError);
    throw new Error(`Failed to restore transaction: ${logError.message}`);
  }
}
