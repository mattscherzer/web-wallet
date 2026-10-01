import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MinusCircle,
  Calendar,
  Home,
  BookOpen,
  HeartHandshake,
  MessageCircle,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { createTransaction, getAccountLabel, type AccountId } from '../db/database';
import { getTodayString } from '../utils/dateHelpers';
import { useAccountBalances } from '../db/hooks';
import {
  DEFAULT_EXPENSE_ACCOUNT,
  EXPENSE_ACCOUNT_IDS,
  buildExpenseInput,
  wouldOverdraw,
} from '../utils/expense';
import PinModal from '../components/PinModal';
import PaymentMethodSelector from '../components/PaymentMethodSelector';
import { PAYMENT_OPTIONS, type PaymentOption } from '../components/paymentOptions';

const EXPENSE_METHODS: PaymentOption[] = EXPENSE_ACCOUNT_IDS.map((id) => ({
  id,
  ...PAYMENT_OPTIONS[id]!,
}));

const CATEGORIES = [
  { id: 'rent', label: 'Rent', icon: <Home size={16} /> },
  { id: 'literature', label: 'Literature', icon: <BookOpen size={16} /> },
  { id: 'donation', label: 'Donation', icon: <HeartHandshake size={16} /> },
  { id: 'other', label: 'Other', icon: <MessageCircle size={16} /> },
];

export default function AddExpensePage() {
  const navigate = useNavigate();
  const today = getTodayString();

  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(today);
  const [category, setCategory] = useState('rent');
  const [customCategory, setCustomCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [accountId, setAccountId] = useState<AccountId>(DEFAULT_EXPENSE_ACCOUNT);
  const [showPin, setShowPin] = useState(false);
  const balances = useAccountBalances();
  const overdraws = wouldOverdraw(balances[accountId] ?? 0, parseFloat(amount));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    setShowPin(true);
  };

  const handlePinSuccess = async () => {
    setShowPin(false);
    await createTransaction(
      buildExpenseInput({ amount, date: expenseDate, accountId, category, customCategory, notes })
    );

    navigate('/');
  };

  return (
    <>
      <div className="page-header">
        <MinusCircle size={24} className="page-header__icon" />
        <h1 className="page-header__title">Add Expense</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Paid From */}
        <div className="form-section">
          <label className="form-label">
            <CreditCard size={16} />
            Paid From
          </label>
          <PaymentMethodSelector options={EXPENSE_METHODS} value={accountId} onChange={setAccountId} />
          {overdraws && (
            <p
              role="alert"
              id="expense-overdraft-warning"
              style={{ color: 'var(--color-warning)', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '12px' }}
            >
              <AlertTriangle size={16} />
              This will take {getAccountLabel(accountId)} below €0.
            </p>
          )}
        </div>

        {/* Amount */}
        <div className="amount-input" style={{ marginBottom: '20px' }}>
          <p className="amount-input__label">Total Amount</p>
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
              id="expense-amount-input"
            />
          </div>
        </div>

        {/* Expense Date */}
        <div className="form-section">
          <label className="form-label">
            <Calendar size={16} />
            EXPENSE DATE
          </label>
          <div className="date-input-wrap">
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              id="expense-date-input"
            />
          </div>
        </div>

        {/* Category */}
        <div className="form-section">
          <label className="form-label">Category</label>
          <div className="chip-group">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`chip${category === cat.id ? ' chip--active' : ''}`}
                onClick={() => setCategory(cat.id)}
                id={`category-${cat.id}`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>
          {category === 'other' && (
            <input
              type="text"
              className="form-input"
              placeholder="Please specify category..."
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              style={{ marginTop: '12px' }}
              id="expense-custom-category"
            />
          )}
        </div>

        {/* Notes */}
        <div className="form-section">
          <textarea
            className="form-textarea"
            placeholder="Recipient Details or Justification"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            id="expense-notes-input"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="btn btn--primary"
          disabled={!amount || parseFloat(amount) <= 0}
          id="expense-save-btn"
        >
          Save Expense
        </button>
      </form>

      <PinModal
        isOpen={showPin}
        onSuccess={handlePinSuccess}
        onCancel={() => setShowPin(false)}
        title="Confirm Expense"
      />
    </>
  );
}
