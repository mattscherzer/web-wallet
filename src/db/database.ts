import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────
export type AccountId = 'cash' | 'paypal' | 'bank' | 'prudent_reserve';
export type TransactionType = 'inflow' | 'outflow' | 'transfer';
export type AuditAction = 'create' | 'update' | 'delete';

export interface Account {
  id: AccountId;
  name: string;
  icon: string;
  /** If true, balance is excluded from Total Available Balance */
  isReserve?: boolean;
}

export interface Transaction {
  id: string;
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
}

export interface AuditEntry {
  id: string;
  transaction_id: string;
  action: AuditAction;
  timestamp: string;
  previous_data?: Partial<Transaction> | null;
  new_data?: Partial<Transaction> | null;
}

// ─── Static Account Data ────────────────────────────────
export const ACCOUNTS: Account[] = [
  { id: 'cash', name: 'Cash Balance', icon: 'wallet' },
  { id: 'paypal', name: 'PayPal Balance', icon: 'credit-card' },
  { id: 'bank', name: 'Bank Account', icon: 'landmark' },
  { id: 'prudent_reserve', name: 'Prudent Reserve', icon: 'shield', isReserve: true },
];

export const MAIN_ACCOUNTS = ACCOUNTS.filter((a) => !a.isReserve);
export const RESERVE_ACCOUNTS = ACCOUNTS.filter((a) => a.isReserve);

// ─── Account label helper ───────────────────────────────
export function getAccountLabel(id: AccountId): string {
  return ACCOUNTS.find((a) => a.id === id)?.name ?? id;
}

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
  data: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'deleted'>
): Promise<string> {
  const { data: inserted, error } = await supabase
    .from('transactions')
    .insert({
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

  await supabase.from('audit_log').insert({
    transaction_id: id,
    action: 'create' as AuditAction,
    new_data: { ...data, id },
  });

  return id;
}

// ─── Create Transfer (between accounts) ─────────────────
export async function createTransfer(data: {
  amount: number;
  date: string;
  from_account_id: AccountId;
  account_id: AccountId;
  notes: string;
}): Promise<string> {
  return createTransaction({
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
  updates: Partial<Omit<Transaction, 'id' | 'created_at' | 'deleted'>>
): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) throw new Error('Transaction not found');

  const now = new Date().toISOString();
  const updateData = { ...updates, updated_at: now };

  const { error } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', id);

  if (error) throw new Error(`Failed to update transaction: ${error.message}`);

  await supabase.from('audit_log').insert({
    transaction_id: id,
    action: 'update' as AuditAction,
    previous_data: existing,
    new_data: { ...existing, ...updateData },
  });
}

// ─── Soft-Delete Transaction ────────────────────────────
export async function deleteTransaction(id: string): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) throw new Error('Transaction not found');

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('transactions')
    .update({ deleted: true, updated_at: now })
    .eq('id', id);

  if (error) throw new Error(`Failed to delete transaction: ${error.message}`);

  await supabase.from('audit_log').insert({
    transaction_id: id,
    action: 'delete' as AuditAction,
    previous_data: existing,
  });
}
