import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, HandCoins, ReceiptEuro } from 'lucide-react';
import type { TransactionType } from '../domain/transaction';

const ARROWS = { inflow: ArrowDownLeft, outflow: ArrowUpRight, transfer: ArrowLeftRight };
const COINS = { inflow: HandCoins, outflow: ReceiptEuro, transfer: ArrowLeftRight };

export default function TransactionIcon({ type, coins = false }: { type: TransactionType; coins?: boolean }) {
  const Glyph = (coins ? COINS : ARROWS)[type];
  return (
    <span className={`transaction-item__icon transaction-item__icon--${type}`} aria-hidden="true">
      <Glyph size={20} />
    </span>
  );
}
