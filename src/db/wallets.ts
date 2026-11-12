import { supabase } from './supabase';
import { availableByWallet, type BalanceInput } from '../domain/balances';
import { validateWalletName, WalletNameError, type Wallet } from '../domain/wallet';
import { fetchAllRows } from './queries';

export async function fetchWallets(): Promise<Wallet[]> {
  const { data, error } = await supabase.from('wallets').select('*').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Wallet[];
}

/** Creates a wallet with the logged-in owner as its owner, in one step in the database. */
export async function createWallet(rawName: string): Promise<Wallet> {
  const name = validateWalletName(rawName);

  const { data: id, error } = await supabase.rpc('create_wallet', { name });
  if (error) {
    if (error.code === '23505') throw new WalletNameError('A wallet with that name already exists');
    if (error.code === '42501') throw new WalletNameError('Only owners can create wallets');
    throw new Error(error.message);
  }
  const { data, error: readError } = await supabase.from('wallets').select('*').eq('id', id).single();
  if (readError) throw new Error(readError.message);
  return data as Wallet;
}

type WalletBalanceRow = BalanceInput & { wallet_id: string };

export async function fetchWalletAvailableBalances(walletIds: string[]): Promise<Record<string, number>> {
  const rows = await fetchAllRows<WalletBalanceRow>((from, to) =>
    supabase
      .from('transactions')
      .select('wallet_id, type, amount, account_id, from_account_id')
      .eq('deleted', false)
      .order('id')
      .range(from, to),
  ).catch((error: { message: string }) => {
    throw new Error(error.message);
  });
  return availableByWallet(walletIds, rows);
}
