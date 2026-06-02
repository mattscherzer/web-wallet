import React, { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Landmark,
  Calendar,
  Home,
  Wallet,
  CreditCard,
  Calculator,
  Euro,
} from 'lucide-react';
import { createTransaction, type AccountId } from '../db/database';
import { getTodayString } from '../utils/dateHelpers';
import PinModal from '../components/PinModal';
import CashCalculator from '../components/CashCalculator';

const REASONS = [
  { id: '7th-tradition', label: '7th Tradition' },
  { id: 'literature', label: 'Literature' },
  { id: 'other', label: 'Other' },
];

const PAYMENT_METHODS: { id: AccountId; label: string; icon: React.ReactNode }[] = [
  { id: 'cash', label: 'Cash', icon: <Wallet size={24} /> },
  { id: 'paypal', label: 'PayPal', icon: <CreditCard size={24} /> },
  { id: 'bank', label: 'Bank Transfer', icon: <Landmark size={24} /> },
];

export default function AddMoneyPage() {
  const navigate = useNavigate();
  const today = getTodayString();

  const [operationDate, setOperationDate] = useState(today);
  const [reason, setReason] = useState('7th-tradition');
  const [customReason, setCustomReason] = useState('');
  const [collectionNotes, setCollectionNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<AccountId>('cash');
  const [amount, setAmount] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showCalc, setShowCalc] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    setShowPin(true);
  };

  const handlePinSuccess = async () => {
    setShowPin(false);
    const numAmount = parseFloat(amount);

    const reasonText = reason === 'other' ? customReason : reason;
    const notesText = collectionNotes
      ? `${reasonText !== reason ? '' : ''}${collectionNotes}`
      : '';

    await createTransaction({
      type: 'inflow',
      amount: numAmount,
      date: operationDate,
      accountId: paymentMethod,
      category: reason,
      notes: notesText,
      reason: reason === 'other' ? customReason : reasonText,
    });

    navigate('/');
  };

  const handleCalcApply = (total: number) => {
    setAmount(total.toFixed(2));
  };

  return (
    <>
      <div className="page-header">
        <Landmark size={24} className="page-header__icon" />
        <h1 className="page-header__title">Add Money</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-card" style={{ marginBottom: '20px' }}>
          {/* Operation Date */}
          <div className="form-section">
            <label className="form-label">
              <Calendar size={16} />
              Operation Date
            </label>
            <div className="date-input-wrap">
              <input
                type="date"
                value={operationDate}
                onChange={(e) => setOperationDate(e.target.value)}
                id="add-operation-date"
              />
            </div>
          </div>

          {/* Reason for Inflow */}
          <div className="form-section">
            <label className="form-label">
              <Home size={16} />
              Reason for Inflow
            </label>
            <div className="chip-group">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`chip${reason === r.id ? ' chip--active' : ''}`}
                  onClick={() => setReason(r.id)}
                  id={`reason-${r.id}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {reason === 'other' && (
              <input
                type="text"
                className="form-input"
                placeholder="Please specify reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                style={{ marginTop: '12px' }}
                id="add-custom-reason"
              />
            )}
          </div>

          {/* Collection Notes (optional) */}
          <div className="form-section">
            <label className="form-label">
              <Calendar size={16} />
              Collection Period / Notes (optional)
            </label>
            <textarea
              className="form-textarea"
              placeholder="e.g. Collection from May 14 to May 28, or any relevant notes..."
              value={collectionNotes}
              onChange={(e) => setCollectionNotes(e.target.value)}
              rows={2}
              id="add-collection-notes"
            />
          </div>
        </div>

        {/* Payment Method */}
        <div className="form-section">
          <label className="form-label">
            <CreditCard size={16} />
            Payment Method
          </label>
          <div className="payment-card-group">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.id}
                type="button"
                className={`payment-card${paymentMethod === pm.id ? ' payment-card--active' : ''}`}
                onClick={() => setPaymentMethod(pm.id)}
                id={`payment-${pm.id}`}
              >
                <span className="payment-card__icon">{pm.icon}</span>
                <span className="payment-card__label">{pm.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="form-section">
          <label className="form-label">
            <Euro size={16} />
            Total Amount
          </label>
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
                id="add-amount-input"
              />
            </div>
          </div>
        </div>

        {/* Cash Calculator Button */}
        <button
          type="button"
          className="btn--cash-calc"
          onClick={() => setShowCalc(true)}
          id="open-cash-calc-btn"
        >
          <Calculator size={18} />
          Open Cash Calculator
        </button>

        {/* Submit */}
        <div style={{ marginTop: '24px' }}>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!amount || parseFloat(amount) <= 0}
            id="add-confirm-btn"
          >
            Confirm Entry
          </button>
        </div>
      </form>

      <PinModal
        isOpen={showPin}
        onSuccess={handlePinSuccess}
        onCancel={() => setShowPin(false)}
        title="Confirm Deposit"
      />

      <CashCalculator
        isOpen={showCalc}
        onClose={() => setShowCalc(false)}
        onApply={handleCalcApply}
      />
    </>
  );
}
