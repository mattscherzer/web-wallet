// Data for the Record / Entry / History screen tests. Imports nothing from app code.
import { twoWalletRows } from './fakeSupabase';

/** Wallet A with three live entries and one removed entry. */
export function transactionRows() {
  const rows = twoWalletRows();
  return {
    ...rows,
    transactions: [
      ...rows.transactions,
      {
        id: 't5',
        wallet_id: 'wa',
        type: 'outflow',
        amount: 80,
        date: '2026-03-05',
        account_id: 'cash',
        from_account_id: null,
        category: 'rent',
        notes: 'a5 dup',
        deleted: true,
        removed_reason: 'Duplicate',
        removed_by: 'Anna',
        created_at: '2026-03-05T10:00:00Z',
      },
    ],
  };
}
