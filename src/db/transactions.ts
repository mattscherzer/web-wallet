import { supabase } from './supabase';
import { isRemoveReason, type AuditAction, type Transaction } from '../domain/transaction';

// The history row is written after the change; if it fails the change is undone, so nothing is changed without a trace.
async function recordHistory(
  row: Record<string, unknown>,
  undo: () => PromiseLike<{ error: unknown }>,
  undoFailed: string,
  failed: string,
): Promise<void> {
  const { error: logError } = await supabase.from('audit_log').insert(row);
  if (!logError) return;
  const { error: undoError } = await undo();
  if (undoError) console.error(undoFailed, undoError);
  throw new Error(`${failed}: ${logError.message}`);
}

export async function createTransaction(
  data: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'deleted'>,
  actor?: string,
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

  // An entry without a history row must not be left behind.
  await recordHistory(
    {
      wallet_id: data.wallet_id,
      transaction_id: id,
      action: 'create' as AuditAction,
      timestamp: new Date().toISOString(),
      actor: actor ?? null,
      new_data: { ...data, id },
    },
    () => supabase.from('transactions').delete().eq('id', id).eq('wallet_id', data.wallet_id),
    'Could not remove entry after a history failure',
    'Failed to create transaction',
  );

  return id;
}

export async function updateTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'created_at' | 'deleted'>>,
  meta: { walletId?: string; reason?: string; actor?: string } = {},
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

  // An edit is never kept without its history: put the old values back.
  const original = Object.fromEntries(Object.entries(previous).filter(([key]) => key in updateData));
  await recordHistory(
    {
      wallet_id: existing.wallet_id,
      transaction_id: id,
      action: 'update' as AuditAction,
      timestamp: now,
      previous_data: previous,
      new_data: { ...previous, ...updateData },
      reason: meta.reason ?? null,
      actor: meta.actor ?? null,
    },
    () => supabase.from('transactions').update(original).eq('id', id).eq('wallet_id', existing.wallet_id),
    'Could not undo edit after a history failure',
    'Failed to update transaction',
  );
}

// A removed entry stays in the books, marked removed, and stops counting in balances.
export async function removeTransaction(
  id: string,
  { walletId, reason, note, actor }: { walletId: string; reason: string; note?: string; actor?: string },
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

  await recordHistory(
    {
      wallet_id: walletId,
      transaction_id: id,
      action: 'remove' as AuditAction,
      timestamp: now,
      reason,
      note: note?.trim() || null,
      actor: actor ?? null,
    },
    () =>
      supabase
        .from('transactions')
        .update({ deleted: false, removed_reason: null, removed_note: null, removed_by: null, removed_at: null })
        .eq('id', id)
        .eq('wallet_id', walletId),
    'Could not undo removal after a history failure',
    'Failed to remove transaction',
  );
}

export async function restoreTransaction(
  id: string,
  { walletId, actor }: { walletId: string; actor?: string },
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

  await recordHistory(
    { wallet_id: walletId, transaction_id: id, action: 'restore' as AuditAction, timestamp: now, actor: actor ?? null },
    () =>
      supabase
        .from('transactions')
        .update({ deleted: true, ...removed })
        .eq('id', id)
        .eq('wallet_id', walletId),
    'Could not undo restore after a history failure',
    'Failed to restore transaction',
  );
}
