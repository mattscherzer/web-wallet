import type { ReactNode } from 'react';
import { Wallet, CreditCard, Landmark } from 'lucide-react';
import type { AccountId } from '../db/accounts';

export interface PaymentOption {
  id: AccountId;
  label: string;
  icon: ReactNode;
}

/** Accounts a payment can be made from or into. The prudent reserve is deliberately excluded. */
export const PAYMENT_OPTIONS: PaymentOption[] = [
  { id: 'cash', label: 'Cash', icon: <Wallet size={24} /> },
  { id: 'paypal', label: 'PayPal', icon: <CreditCard size={24} /> },
  { id: 'bank', label: 'Bank', icon: <Landmark size={24} /> },
];
