// Static account metadata. Kept free of Supabase imports so pure logic
// (balances, CSV export) can depend on it and be unit-tested in isolation.

export type AccountId = 'cash' | 'paypal' | 'bank' | 'prudent_reserve';

export interface Account {
  id: AccountId;
  name: string;
  icon: string;
  /** If true, balance is excluded from Total Available Balance */
  isReserve?: boolean;
}

export const ACCOUNTS: Account[] = [
  { id: 'cash', name: 'Cash Balance', icon: 'wallet' },
  { id: 'paypal', name: 'PayPal Balance', icon: 'credit-card' },
  { id: 'bank', name: 'Bank Account', icon: 'landmark' },
  { id: 'prudent_reserve', name: 'Prudent Reserve', icon: 'shield', isReserve: true },
];

export const MAIN_ACCOUNTS = ACCOUNTS.filter((a) => !a.isReserve);
export const RESERVE_ACCOUNTS = ACCOUNTS.filter((a) => a.isReserve);

/** Display name for an account id. */
export function getAccountLabel(id: AccountId): string {
  return ACCOUNTS.find((a) => a.id === id)?.name ?? id;
}

/** Label for the source account of a transfer; a missing source shows as "Unknown account". */
export function fromAccountLabel(tx: { from_account_id?: AccountId | null }): string {
  return tx.from_account_id ? getAccountLabel(tx.from_account_id) : 'Unknown account';
}
