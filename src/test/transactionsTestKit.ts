// Data for the Record / Entry / History screen tests. Imports nothing from app code.
import { twoWalletRows } from './fakeSupabase';

/** Wallet A with three live entries and one removed entry, plus the unlock PIN. */
export function transactionRows() {
  const rows = twoWalletRows();
  return {
    ...rows,
    app_config: [{ key: 'pin', value: '1234' }],
    transactions: [
      ...rows.transactions,
      { id: 't5', wallet_id: 'wa', type: 'outflow', amount: 80, date: '2026-03-05', account_id: 'cash', from_account_id: null, category: 'rent', notes: 'a5 dup', deleted: true, removed_reason: 'Duplicate', removed_by: 'Anna', created_at: '2026-03-05T10:00:00Z' },
    ],
  };
}

/** Types a PIN into the confirmation modal that every change still goes through. */
export async function enterPin(pin: string, fake: { queries: { table: string }[] }) {
  const { fireEvent, waitFor } = await import('@testing-library/react');
  await waitFor(() => {
    if (!document.getElementById('pin-input-0')) throw new Error('PIN modal not open');
    if (!fake.queries.some((q) => q.table === 'app_config')) throw new Error('PIN not loaded');
    // The modal clears its digits shortly after opening; typing before that would be wiped or ignored.
    for (let i = 0; i < 4; i++) {
      if ((document.getElementById(`pin-input-${i}`) as HTMLInputElement).value !== '') throw new Error('PIN not cleared');
    }
  });
  [...pin].forEach((d, i) => fireEvent.change(document.getElementById(`pin-input-${i}`)!, { target: { value: d } }));
}
