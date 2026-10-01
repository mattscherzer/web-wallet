import type { AccountId } from '../db/accounts';
import type { PaymentOption } from './paymentOptions';

interface Props {
  options: PaymentOption[];
  value: AccountId;
  onChange: (id: AccountId) => void;
}

export default function PaymentMethodSelector({ options, value, onChange }: Props) {
  return (
    <div className="payment-card-group">
      {options.map((pm) => (
        <button
          key={pm.id}
          type="button"
          className={`payment-card${value === pm.id ? ' payment-card--active' : ''}`}
          onClick={() => onChange(pm.id)}
          id={`payment-${pm.id}`}
        >
          <span className="payment-card__icon">{pm.icon}</span>
          <span className="payment-card__label">{pm.label}</span>
        </button>
      ))}
    </div>
  );
}
