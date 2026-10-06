import { supabase } from './supabase';
import { MAIN_ACCOUNTS } from './accounts';
import { computeAccountBalances, type BalanceInput } from './balances';

export const MAX_WALLET_NAME = 60;

export interface Wallet {
  id: string;
  name: string;
  currency: 'EUR';
  created_at: string;
}

/** A problem with the name the user typed, safe to show as is. */
export class WalletNameError extends Error {}

export async function fetchWallets(): Promise<Wallet[]> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Wallet[];
}

export async function createWallet(rawName: string): Promise<Wallet> {
  const name = rawName.trim();
  if (!name) throw new WalletNameError('Enter a wallet name');
  if (name.length > MAX_WALLET_NAME) {
    throw new WalletNameError(`That name is too long (max ${MAX_WALLET_NAME} characters)`);
  }

  const { data, error } = await supabase.from('wallets').insert({ name }).select('*').single();
  if (error) {
    if (error.code === '23505') throw new WalletNameError('A wallet with that name already exists');
    throw new Error(error.message);
  }
  return data as Wallet;
}

type WalletBalanceRow = BalanceInput & { wallet_id: string };

/** Available money (operating accounts only) per wallet; wallets without entries are 0. */
export function availableByWallet(
  walletIds: string[],
  rows: WalletBalanceRow[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const id of walletIds) {
    const balances = computeAccountBalances(rows.filter((r) => r.wallet_id === id));
    const total = MAIN_ACCOUNTS.reduce((sum, a) => sum + (balances[a.id] ?? 0), 0);
    result[id] = Math.round(total * 100) / 100;
  }
  return result;
}

export async function fetchWalletAvailableBalances(
  walletIds: string[],
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('transactions')
    .select('wallet_id, type, amount, account_id, from_account_id')
    .eq('deleted', false);
  if (error) throw new Error(error.message);
  return availableByWallet(walletIds, (data ?? []) as WalletBalanceRow[]);
}
