import { type ReactNode } from 'react';
import { AuthContext, type AuthValue } from '../auth/authContext';
import { OwnerConfirmContext } from '../auth/ownerConfirmContext';
import { twoWalletRows } from './fakeSupabase';

let seq = 0;
const row = (fields: Record<string, unknown>) => {
  seq += 1;
  return {
    id: `r${seq}`,
    wallet_id: 'wb',
    from_account_id: null,
    category: 'sales',
    notes: '',
    deleted: false,
    created_at: `2026-01-01T10:00:${String(seq).padStart(2, '0')}Z`,
    updated_at: `2026-01-01T10:00:00Z`,
    ...fields,
  };
};

const august = () => [
  row({ type: 'inflow', amount: 1000, account_id: 'bank', date: '2026-08-15' }),
  row({ type: 'inflow', amount: 64.4, account_id: 'cash', date: '2026-08-20' }),
  row({ type: 'inflow', amount: 550, account_id: 'prudent_reserve', date: '2026-08-21' }),
];

const september = () => [
  row({ type: 'inflow', amount: 200.9, account_id: 'bank', date: '2026-09-03' }),
  row({ type: 'inflow', amount: 95, account_id: 'paypal', date: '2026-09-05' }),
  row({ type: 'outflow', amount: 100, account_id: 'cash', date: '2026-09-08', category: 'rent' }),
  row({ type: 'transfer', amount: 50, account_id: 'prudent_reserve', from_account_id: 'bank', date: '2026-09-12' }),
];

export const reportRows = (opts: { september?: boolean; removed?: boolean } = {}) => ({
  ...twoWalletRows(),
  transactions: [
    ...august(),
    ...(opts.september === false ? [] : september()),
    ...(opts.removed
      ? [row({ type: 'inflow', amount: 999, account_id: 'cash', date: '2026-09-04', deleted: true })]
      : []),
  ],
});

export const TODAY = new Date(2026, 8, 24, 12);

export const asAuth = (can: (action: string) => boolean, children: ReactNode) => (
  <AuthContext.Provider value={{ can } as AuthValue}>{children}</AuthContext.Provider>
);

export const withOwnerConfirm = (confirm: () => Promise<boolean>, children: ReactNode) => (
  <OwnerConfirmContext.Provider value={confirm}>{children}</OwnerConfirmContext.Provider>
);
