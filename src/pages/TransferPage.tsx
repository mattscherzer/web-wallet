import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Calendar,
  Wallet,
  CreditCard,
  Landmark,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { createTransfer, ACCOUNTS, type AccountId } from '../db/database';
import { getTodayString } from '../utils/dateHelpers';
import PinModal from '../components/PinModal';

const ACCOUNT_OPTIONS: { id: AccountId; label: string; icon: React.ReactNode }[] = [
  { id: 'cash', label: 'Cash', icon: <Wallet size={24} /> },
  { id: 'paypal', label: 'PayPal', icon: <CreditCard size={24} /> },
  { id: 'bank', label: 'Bank', icon: <Landmark size={24} /> },
  { id: 'prudent_reserve', label: 'Reserve', icon: <Shield size={24} /> },
];

export default function TransferPage() {
  const navigate = useNavigate();
  const today = getTodayString();

  const [fromAccount, setFromAccount] = useState<AccountId>('cash');
  const [toAccount, setToAccount] = useState<AccountId>('bank');
  const [amount, setAmount] = useState('');
  const [transferDate, setTransferDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [showPin, setShowPin] = useState(false);

  const isValid =
    amount &&
    parseFloat(amount) > 0 &&
    fromAccount !== toAccount;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setShowPin(true);
  };

  const handlePinSuccess = async () => {
    setShowPin(false);

    await createTransfer({
      amount: parseFloat(amount),
      date: transferDate,
      from_account_id: fromAccount,
      account_id: toAccount,
      notes,
    });

    navigate('/');
  };

  const fromLabel = ACCOUNTS.find((a) => a.id === fromAccount)?.name ?? fromAccount;
  const toLabel = ACCOUNTS.find((a) => a.id === toAccount)?.name ?? toAccount;

  return (
    <>
      <div className="page-header">
        <ArrowLeftRight size={24} className="page-header__icon" />
        <h1 className="page-header__title">Transfer</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* From Account */}
        <div className="form-section">
          <label className="form-label">From Account</label>
          <div className="payment-card-group">
            {ACCOUNT_OPTIONS.map((acc) => (
              <button
                key={acc.id}
                type="button"
                className={`payment-card${fromAccount === acc.id ? ' payment-card--active' : ''}${toAccount === acc.id ? ' payment-card--disabled' : ''}`}
                onClick={() => {
                  if (acc.id !== toAccount) setFromAccount(acc.id);
                }}
                disabled={acc.id === toAccount}
                id={`from-${acc.id}`}
              >
                <span className="payment-card__icon">{acc.icon}</span>
                <span className="payment-card__label">{acc.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Direction Arrow */}
        <div className="transfer-direction">
          <div className="transfer-direction__line" />
          <div className="transfer-direction__icon">
            <ArrowRight size={20} />
          </div>
          <div className="transfer-direction__labels">
            <span>{fromLabel}</span>
            <ArrowRight size={14} />
            <span>{toLabel}</span>
          </div>
          <div className="transfer-direction__line" />
        </div>

        {/* To Account */}
        <div className="form-section">
          <label className="form-label">To Account</label>
          <div className="payment-card-group">
            {ACCOUNT_OPTIONS.map((acc) => (
              <button
                key={acc.id}
                type="button"
                className={`payment-card${toAccount === acc.id ? ' payment-card--active' : ''}${fromAccount === acc.id ? ' payment-card--disabled' : ''}`}
                onClick={() => {
                  if (acc.id !== fromAccount) setToAccount(acc.id);
                }}
                disabled={acc.id === fromAccount}
                id={`to-${acc.id}`}
              >
                <span className="payment-card__icon">{acc.icon}</span>
                <span className="payment-card__label">{acc.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="form-section">
          <label className="form-label">Transfer Amount</label>
          <div className="amount-input">
            <div className="amount-input__field">
              <span className="amount-input__currency">€</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="amount-input__value"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                id="transfer-amount-input"
              />
            </div>
          </div>
        </div>

        {/* Date */}
        <div className="form-section">
          <label className="form-label">
            <Calendar size={16} />
            Transfer Date
          </label>
          <div className="date-input-wrap">
            <input
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              id="transfer-date-input"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="form-section">
          <textarea
            className="form-textarea"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            id="transfer-notes-input"
          />
        </div>

        {/* Validation message */}
        {fromAccount === toAccount && (
          <p className="form-error">Source and destination accounts must be different.</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="btn btn--primary"
          disabled={!isValid}
          id="transfer-confirm-btn"
        >
          Confirm Transfer
        </button>
      </form>

      <PinModal
        isOpen={showPin}
        onSuccess={handlePinSuccess}
        onCancel={() => setShowPin(false)}
        title="Confirm Transfer"
      />
    </>
  );
}
