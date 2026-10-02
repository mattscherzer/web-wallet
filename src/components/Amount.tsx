import { formatSignedCurrency } from '../utils/formatCurrency';

export type AmountType = 'inflow' | 'outflow' | 'transfer';

const WORDS: Record<AmountType, { sr: string; tag: string }> = {
  inflow: { sr: 'Money in', tag: 'In' },
  outflow: { sr: 'Money out', tag: 'Out' },
  transfer: { sr: 'Transfer', tag: 'Transfer' },
};

interface AmountProps {
  type: AmountType;
  amount: number;
  /** Defaults to the device language. */
  locale?: string;
}

/**
 * A transaction amount that never relies on colour alone:
 * sign + figure, a word tag, and the same word for screen readers before the figure.
 */
export default function Amount({ type, amount, locale }: AmountProps) {
  const { sr, tag } = WORDS[type];
  return (
    <span className={`amount amount--${type}`}>
      <span className="amount__figure num">
        <span className="sr-only">{sr} </span>
        {formatSignedCurrency(amount, type, locale)}
      </span>
      <span className="amount__tag" aria-hidden="true">{tag}</span>
    </span>
  );
}
