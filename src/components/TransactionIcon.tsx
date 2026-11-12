import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, HandCoins, ReceiptEuro } from 'lucide-react';
import type { TransactionType } from '../domain/transaction';

const ARROWS = { inflow: ArrowDownLeft, outflow: ArrowUpRight, transfer: ArrowLeftRight };
const COINS = { inflow: HandCoins, outflow: ReceiptEuro, transfer: ArrowLeftRight };

/** The round inflow, outflow or transfer icon of a transaction row; `coins` swaps the arrows for the dashboard's glyphs. */
export default function TransactionIcon({ type, coins = false }: { type: TransactionType; coins?: boolean }) {
  const Glyph = (coins ? COINS : ARROWS)[type];
  return (
    <div className={`transaction-item__icon transaction-item__icon--${type}`} aria-hidden="true">
      <Glyph size={20} />
    </div>
  );
}
