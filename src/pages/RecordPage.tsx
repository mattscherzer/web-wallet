import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Calculator, X } from 'lucide-react';
import { ACCOUNTS, createTransaction, getAccountLabel, type AccountId } from '../db/database';
import { useLoadedAccountBalances } from '../db/hooks';
import { emptyBalances } from '../db/balances';
import { getTodayString } from '../utils/dateHelpers';
import { formatCurrency } from '../utils/formatCurrency';
import { wouldOverdraw } from '../utils/expense';
import {
  CATEGORIES,
  TYPE_PARAMS,
  parseAmount,
  recordActionLabel,
  recordPreview,
  toTransactionInput,
  validateRecord,
  type FieldError,
  type RecordForm,
  type RecordType,
} from '../utils/recordForm';
import ErrorSummary from '../components/ErrorSummary';
import PinModal from '../components/PinModal';
import CashCalculator from '../components/CashCalculator';
import { useWallet } from '../wallet/useWallet';

const TYPES: { id: RecordType; label: string }[] = [
  { id: 'inflow', label: 'Money in' },
  { id: 'outflow', label: 'Money out' },
  { id: 'transfer', label: 'Transfer' },
];

const FIELD_IDS: Record<FieldError['field'], string> = {
  amount: 'record-amount',
  accountId: 'record-account',
  description: 'record-description',
  date: 'record-date',
};

const SAVE_FAILED = "Couldn't record this entry. Nothing was saved. Try again.";

/** One screen for money in, money out and transfers. The type comes from the address (?type=in|out|transfer). */
export default function RecordPage() {
  const navigate = useNavigate();
  const { current: wallet } = useWallet();
  const [params] = useSearchParams();
  // null until the balances have really been fetched, so nothing is previewed or warned from zeros.
  const loadedBalances = useLoadedAccountBalances();

  const [form, setForm] = useState<RecordForm>(() => {
    const type = TYPE_PARAMS[params.get('type') ?? ''] ?? 'inflow';
    return {
      type,
      amount: '',
      accountId: type === 'transfer' ? 'bank' : 'cash',
      fromAccountId: 'cash',
      category: type === 'transfer' ? '' : CATEGORIES[type][0].id,
      description: '',
      date: getTodayString(),
    };
  });
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [errorRound, setErrorRound] = useState(0);
  const [showPin, setShowPin] = useState(false);
  const [showCount, setShowCount] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  // Focus moves to the summary each time a submit finds problems.
  useEffect(() => {
    if (errorRound > 0) summaryRef.current?.focus();
  }, [errorRound]);

  const set = (patch: Partial<RecordForm>) => setForm((f) => ({ ...f, ...patch }));
  const setType = (type: RecordType) => {
    setErrors([]);
    set({
      type,
      category: type === 'transfer' ? '' : CATEGORIES[type][0].id,
      accountId: type === 'transfer' ? (form.fromAccountId === 'bank' ? 'cash' : 'bank') : form.accountId,
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaveError(null);
    const found = validateRecord(form);
    setErrors(found);
    if (found.length > 0) {
      setErrorRound((n) => n + 1);
      return;
    }
    setShowPin(true);
  };

  const save = async () => {
    setShowPin(false);
    if (!wallet) {
      setSaveError(SAVE_FAILED);
      return;
    }
    setSaving(true);
    try {
      const id = await createTransaction(toTransactionInput(form, wallet.id));
      navigate(`/recorded/${id}`);
    } catch {
      setSaveError(SAVE_FAILED);
      setSaving(false);
    }
  };

  const errorFor = (field: FieldError['field']) => errors.find((e) => e.field === field)?.message;
  const fieldProps = (field: FieldError['field']) => ({
    id: FIELD_IDS[field],
    'aria-invalid': errorFor(field) ? true : undefined,
    'aria-describedby': errorFor(field) ? `${FIELD_IDS[field]}-error` : undefined,
  });
  const message = (field: FieldError['field']) =>
    errorFor(field) && (
      <p id={`${FIELD_IDS[field]}-error`} className="field-error">{errorFor(field)}</p>
    );

  const isTransfer = form.type === 'transfer';
  const preview = recordPreview(form, loadedBalances ?? emptyBalances());
  const overdraws =
    form.type === 'outflow' && wouldOverdraw(loadedBalances?.[form.accountId] ?? null, parseAmount(form.amount));
  const categories = form.type === 'transfer' ? [] : CATEGORIES[form.type];
  const descriptionLabel =
    form.type === 'outflow'
      ? 'Paid to or what for'
      : form.type === 'inflow' && form.category === 'other'
        ? 'What was it for?'
        : 'Notes (optional)';

  const accountChoices = (name: string, value: AccountId, onPick: (id: AccountId) => void, invalidId?: string) => (
    <div className="choice-group" role="radiogroup" aria-label={name}>
      {ACCOUNTS.map((a) => (
        <label key={a.id} className={`choice${value === a.id ? ' choice--on' : ''}`}>
          <input
            type="radio"
            name={name}
            value={a.id}
            checked={value === a.id}
            onChange={() => onPick(a.id)}
            id={a.id === value ? invalidId : undefined}
          />
          <span>{a.name}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="record">
      <div className="record__bar">
        <h1 className="record__title">Record</h1>
        <Link to="/" className="icon-btn" aria-label="Cancel and close">
          <X size={24} aria-hidden="true" />
        </Link>
      </div>

      {errors.length > 0 && <ErrorSummary ref={summaryRef} errors={errors} fieldIds={FIELD_IDS} />}
      {saveError && <p className="field-error" role="alert">{saveError}</p>}

      <form onSubmit={submit} noValidate>
        <div className="type-group" role="radiogroup" aria-label="Type of entry">
          {TYPES.map((t) => (
            <label key={t.id} className={`type-group__item${form.type === t.id ? ' type-group__item--on' : ''}`}>
              <input type="radio" name="type" value={t.id} checked={form.type === t.id} onChange={() => setType(t.id)} />
              <span>{t.label}</span>
            </label>
          ))}
        </div>

        <div className="form-section">
          <label className="form-label" htmlFor={FIELD_IDS.amount}>Amount</label>
          <div className="amount-field">
            <span className="amount-field__sign" aria-hidden="true">
              {form.type === 'outflow' ? '−€' : '€'}
            </span>
            <input
              {...fieldProps('amount')}
              type="text"
              inputMode="decimal"
              className="amount-field__value num"
              placeholder="0.00"
              autoComplete="off"
              value={form.amount}
              onChange={(e) => set({ amount: e.target.value })}
            />
          </div>
          {message('amount')}
          {form.type === 'inflow' && (
            <button type="button" className="btn--cash-calc" onClick={() => setShowCount(true)}>
              <Calculator size={18} aria-hidden="true" />
              Count cash
            </button>
          )}
        </div>

        {isTransfer ? (
          <>
            <div className="form-section">
              <span className="form-label">From account</span>
              {accountChoices('From account', form.fromAccountId, (id) => set({ fromAccountId: id }))}
            </div>
            <div className="form-section">
              <span className="form-label">To account</span>
              {accountChoices('To account', form.accountId, (id) => set({ accountId: id }), FIELD_IDS.accountId)}
              {message('accountId')}
            </div>
          </>
        ) : (
          <div className="form-section">
            <span className="form-label">{form.type === 'inflow' ? 'Into account' : 'From account'}</span>
            {accountChoices(
              form.type === 'inflow' ? 'Into account' : 'From account',
              form.accountId,
              (id) => set({ accountId: id }),
            )}
          </div>
        )}

        {!isTransfer && (
          <div className="form-section">
            <span className="form-label">Category</span>
            <div className="choice-group" role="radiogroup" aria-label="Category">
              {categories.map((c) => (
                <label key={c.id} className={`choice${form.category === c.id ? ' choice--on' : ''}`}>
                  <input type="radio" name="category" value={c.id} checked={form.category === c.id} onChange={() => set({ category: c.id })} />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-section">
          <label className="form-label" htmlFor={FIELD_IDS.description}>{descriptionLabel}</label>
          <input
            {...fieldProps('description')}
            type="text"
            className="form-input"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
          />
          {message('description')}
        </div>

        <div className="form-section">
          <label className="form-label" htmlFor={FIELD_IDS.date}>Date</label>
          <input
            {...fieldProps('date')}
            type="date"
            className="form-input"
            value={form.date}
            onChange={(e) => set({ date: e.target.value })}
          />
          {message('date')}
        </div>

        <div className="preview" aria-live="polite">
          {loadedBalances === null && <p className="preview__line">Checking balances…</p>}
          {loadedBalances !== null && preview.lines.map((line, i) => (
            <p key={`${line.accountId}-${i}`} className="preview__line">
              <span>{getAccountLabel(line.accountId)}</span>
              <span className="num">→ {formatCurrency(line.after)}</span>
            </p>
          ))}
          {loadedBalances !== null && (
            <p className="preview__line">
              <span>Available</span>
              <span className="num">→ {formatCurrency(preview.availableAfter)}</span>
            </p>
          )}
        </div>

        {overdraws && (
          <p className="form-warning" role="status">
            This takes {getAccountLabel(form.accountId)} below {formatCurrency(0)}.
          </p>
        )}

        <button type="submit" className="btn btn--primary" disabled={saving}>{recordActionLabel(form)}</button>
      </form>

      <PinModal isOpen={showPin} onSuccess={save} onCancel={() => setShowPin(false)} title="Confirm entry" />
      <CashCalculator
        isOpen={showCount}
        onClose={() => setShowCount(false)}
        onApply={(total) => set({ amount: total.toFixed(2) })}
      />
    </div>
  );
}
