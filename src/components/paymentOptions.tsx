import type { ReactNode } from 'react';
import { Wallet, CreditCard, Landmark } from 'lucide-react';
import type { AccountId } from '../db/accounts';

export interface PaymentOption {
  id: AccountId;
  label: string;
  icon: ReactNode;
}

export const PAYMENT_OPTIONS: Partial<Record<AccountId, Omit<PaymentOption, 'id'>>> = {
  cash: { label: 'Cash', icon: <Wallet size={24} /> },
  paypal: { label: 'PayPal', icon: <CreditCard size={24} /> },
  bank: { label: 'Bank', icon: <Landmark size={24} /> },
};
