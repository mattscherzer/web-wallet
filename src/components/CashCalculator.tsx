import { useState } from 'react';
import { Calculator, X, Coins, Banknote } from 'lucide-react';

interface CashCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (total: number) => void;
}

interface DenominationRow {
  label: string;
  value: number;
}

const BILLS: DenominationRow[] = [
  { label: '€50', value: 50 },
  { label: '€20', value: 20 },
  { label: '€10', value: 10 },
  { label: '€5', value: 5 },
];

const COINS_LIST: DenominationRow[] = [
  { label: '€2', value: 2 },
  { label: '€1', value: 1 },
  { label: '€0.50', value: 0.5 },
  { label: '€0.20', value: 0.2 },
  { label: '€0.10', value: 0.1 },
  { label: '€0.05', value: 0.05 },
  { label: '€0.02', value: 0.02 },
  { label: '€0.01', value: 0.01 },
];

export default function CashCalculator({ isOpen, onClose, onApply }: CashCalculatorProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  if (!isOpen) return null;

  const handleQuantityChange = (label: string, value: string) => {
    const num = parseInt(value) || 0;
    setQuantities((prev) => ({ ...prev, [label]: Math.max(0, num) }));
  };

  const getSubtotal = (label: string, value: number) => {
    return (quantities[label] || 0) * value;
  };

  const total = [...BILLS, ...COINS_LIST].reduce(
    (sum, d) => sum + getSubtotal(d.label, d.value),
    0
  );

  const handleApply = () => {
    onApply(Math.round(total * 100) / 100);
    setQuantities({});
    onClose();
  };

  const formatAmount = (amount: number) =>
    `€${amount.toFixed(2)}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="calc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calc-modal__header">
          <h2 className="calc-modal__title">
            <Calculator size={22} />
            Cash Calculator
          </h2>
          <button className="calc-modal__close" onClick={onClose} id="calc-close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="calc-modal__body">
          <div className="calc-section">
            <h3 className="calc-section__title">
              <Banknote size={16} />
              BILLS
            </h3>
            {BILLS.map((bill) => (
              <div className="calc-row" key={bill.label}>
                <span className="calc-row__denom">{bill.label}</span>
                <input
                  type="number"
                  min="0"
                  className="calc-row__input"
                  value={quantities[bill.label] || 0}
                  onChange={(e) => handleQuantityChange(bill.label, e.target.value)}
                  id={`calc-bill-${bill.value}`}
                />
                <span className="calc-row__subtotal">
                  {formatAmount(getSubtotal(bill.label, bill.value))}
                </span>
              </div>
            ))}
          </div>

          <div className="calc-section" style={{ marginTop: '24px' }}>
            <h3 className="calc-section__title">
              <Coins size={16} />
              COINS
            </h3>
            {COINS_LIST.map((coin) => (
              <div className="calc-row" key={coin.label}>
                <span className="calc-row__denom">{coin.label}</span>
                <input
                  type="number"
                  min="0"
                  className="calc-row__input"
                  value={quantities[coin.label] || 0}
                  onChange={(e) => handleQuantityChange(coin.label, e.target.value)}
                  id={`calc-coin-${coin.value}`}
                />
                <span className="calc-row__subtotal">
                  {formatAmount(getSubtotal(coin.label, coin.value))}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="calc-modal__footer">
          <p className="calc-modal__total-label">Current Total</p>
          <p className="calc-modal__total-amount">{formatAmount(total)}</p>
          <button className="btn btn--primary" onClick={handleApply} id="calc-apply-btn">
            Apply Total to Form →
          </button>
        </div>
      </div>
    </div>
  );
}
