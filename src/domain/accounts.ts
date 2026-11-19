export type AccountId = 'cash' | 'paypal' | 'bank' | 'prudent_reserve';

export interface Account {
  id: AccountId;
  name: string;
  icon: string;
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

export function getAccountLabel(id: AccountId): string {
  return ACCOUNTS.find((a) => a.id === id)?.name ?? id;
}

export function fromAccountLabel(tx: { from_account_id?: AccountId | null }): string {
  return tx.from_account_id ? getAccountLabel(tx.from_account_id) : 'Unknown account';
}
