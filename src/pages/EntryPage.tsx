import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import {
  EDIT_REASONS,
  REMOVE_REASONS,
  getAccountLabel,
  removeTransaction,
  restoreTransaction,
  updateTransaction,
  type AccountId,
  type AuditEntry,
  type Transaction,
} from '../db/database';
import { useEntry } from '../db/hooks';
import Amount from '../components/Amount';
import PinModal from '../components/PinModal';
import ReasonSheet from '../components/ReasonSheet';
import StatusChip from '../components/StatusChip';
import { formatDate } from '../utils/dateHelpers';
import { formatCurrency } from '../utils/formatCurrency';
import { categoryLabel, parseAmount } from '../utils/recordForm';
import { useWallet } from '../wallet/useWallet';

type Sheet = 'edit' | 'remove' | null;

const CHANGE_FAILED = "Couldn't save the change. Nothing was changed.";

const exactTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' });

/** One entry: the amount, its details and the full change history, with Edit, Remove and Restore. */
export default function EntryPage() {
  const { id = '' } = useParams();
  const { current: wallet } = useWallet();
  const { status, tx, audit, refresh } = useEntry(id);

  const [sheet, setSheet] = useState<Sheet>(null);
  // Every change waits for the PIN, then runs.
  const [pending, setPending] = useState<(() => Promise<void>) | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');

  if (status === 'loading') return <p role="status" className="empty-state__text">Loading…</p>;
  if (status === 'error') {
    return (
      <div className="empty-state">
        <p role="alert" className="empty-state__text">Couldn't load this entry. Check your connection and try again.</p>
        <button type="button" className="btn btn--outline" onClick={() => void refresh()}>Try again</button>
      </div>
    );
  }
  if (status === 'missing' || !tx) {
    return (
      <div className="empty-state">
        <p className="empty-state__text">Entry not found</p>
        <Link to="/history" className="btn btn--outline">Back to history</Link>
      </div>
    );
  }

  const walletId = wallet?.id ?? tx.wallet_id;

  const askPin = (action: () => Promise<void>) => {
    setProblem(null);
    setPending(() => action);
  };

  const runPending = async () => {
    const action = pending;
    setPending(null);
    if (!action) return;
    try {
      await action();
      setSheet(null);
      await refresh();
    } catch {
      setProblem(CHANGE_FAILED);
    }
  };

  const openEdit = () => {
    setEditAmount(String(Number(tx.amount)));
    setEditNotes(tx.notes);
    setProblem(null);
    setSheet('edit');
  };

  const isTransfer = tx.type === 'transfer';
  const removed = tx.deleted;
  const history = [...audit].reverse();

  return (
    <div className="entry">
      <Link to="/history" className="entry__back">
        <ArrowLeft size={20} aria-hidden="true" /> Back to history
      </Link>

      <h1 className="entry__amount">
        <Amount type={tx.type} amount={Number(tx.amount)} />
      </h1>
      <p className="entry__sub">
        {isTransfer
          ? `${getAccountLabel(tx.from_account_id as AccountId)} → ${getAccountLabel(tx.account_id)}`
          : `${tx.type === 'inflow' ? 'Into' : 'From'} ${getAccountLabel(tx.account_id)} · ${categoryLabel(tx.category)}`}
        {tx.created_at !== tx.updated_at && !removed && <StatusChip variant="edited" />}
        {removed && <StatusChip variant="removed" />}
      </p>
      {removed && (
        <p className="entry__removed">
          {tx.removed_reason ? `Removed because it was: ${tx.removed_reason}` : 'No reason recorded'}
          {tx.removed_note ? ` · ${tx.removed_note}` : ''}
        </p>
      )}

      <dl className="detail-list">
        <div><dt>Date</dt><dd>{formatDate(tx.date)}</dd></div>
        <div><dt>Account</dt><dd>{getAccountLabel(tx.account_id)}</dd></div>
        {isTransfer && tx.from_account_id && (
          <div><dt>From account</dt><dd>{getAccountLabel(tx.from_account_id as AccountId)}</dd></div>
        )}
        {!isTransfer && <div><dt>Category</dt><dd>{categoryLabel(tx.category)}</dd></div>}
        {tx.notes && <div><dt>Notes</dt><dd>{tx.notes}</dd></div>}
      </dl>

      <h2 className="entry__heading">Change history</h2>
      <p className="entry__hint">Written automatically. It can't be edited or deleted.</p>
      <ol className="history-log" aria-label="Change history">
        {history.map((e) => (
          <HistoryEvent key={e.id} entry={e} />
        ))}
      </ol>

      {problem && !sheet && <p className="field-error" role="alert">{problem}</p>}

      <div className="entry__toolbar" role="group" aria-label="Entry actions">
        {removed ? (
          <button type="button" className="btn btn--primary" onClick={() => askPin(() => restoreTransaction(tx.id, { walletId }))}>
            <RotateCcw size={18} aria-hidden="true" /> Restore
          </button>
        ) : (
          <>
            <button type="button" className="btn btn--outline" onClick={openEdit}>
              <Pencil size={18} aria-hidden="true" /> Edit
            </button>
            <button type="button" className="btn btn--outline entry__remove" onClick={() => { setProblem(null); setSheet('remove'); }}>
              <Trash2 size={18} aria-hidden="true" /> Remove
            </button>
          </>
        )}
      </div>

      {sheet === 'remove' && (
        <ReasonSheet
          title="Remove this entry?"
          reasons={REMOVE_REASONS}
          reasonLabel="Reason for removing"
          confirmLabel="Remove entry"
          withNote
          error={problem}
          onCancel={() => setSheet(null)}
          onConfirm={(reason, note) =>
            askPin(() => removeTransaction(tx.id, { walletId, reason, note }))
          }
        >
          <p className="sheet__text">It stops counting in balances and reports. It stays in the history and can be restored.</p>
        </ReasonSheet>
      )}

      {sheet === 'edit' && (
        <ReasonSheet
          title="Edit entry"
          reasons={EDIT_REASONS}
          reasonLabel="Reason for change"
          confirmLabel="Save changes"
          error={problem}
          onCancel={() => setSheet(null)}
          validate={() => {
            const amount = parseAmount(editAmount);
            if (!(amount > 0)) return 'Enter an amount above zero, with up to two decimals';
            if (amount === Number(tx.amount) && editNotes.trim() === tx.notes) return 'Change the amount or the notes first';
            return null;
          }}
          onConfirm={(reason) =>
            askPin(() =>
              updateTransaction(
                tx.id,
                { amount: parseAmount(editAmount), notes: editNotes.trim() },
                { walletId, reason },
              ),
            )
          }
        >
          <div className="form-section">
            <label className="form-label" htmlFor="edit-amount">Amount</label>
            <input id="edit-amount" type="text" inputMode="decimal" className="form-input num" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
          </div>
          <div className="form-section">
            <label className="form-label" htmlFor="edit-notes">Notes</label>
            <textarea id="edit-notes" className="form-textarea" rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          </div>
        </ReasonSheet>
      )}

      <PinModal
        isOpen={pending !== null}
        onSuccess={() => void runPending()}
        onCancel={() => setPending(null)}
        title="Confirm change"
      />
    </div>
  );
}

function amountOf(data?: Partial<Transaction> | null): number | undefined {
  return data?.amount === undefined ? undefined : Number(data.amount);
}

function HistoryEvent({ entry }: { entry: AuditEntry }) {
  const title =
    entry.action === 'create' ? 'Created'
      : entry.action === 'update' ? 'Edited'
      : entry.action === 'restore' ? 'Restored'
      : 'Removed';

  const before = amountOf(entry.previous_data);
  const after = amountOf(entry.new_data);
  const notesBefore = entry.previous_data?.notes;
  const notesAfter = entry.new_data?.notes;

  return (
    <li className="history-log__event">
      <p className="history-log__title">{title}</p>
      <time className="history-log__time" dateTime={entry.timestamp}>{exactTime(entry.timestamp)}</time>
      {entry.action === 'update' && (
        <ul className="history-log__changes">
          {before !== undefined && after !== undefined && before !== after && (
            <li>
              Amount: <span className="sr-only">from </span><span className="num">{formatCurrency(before)}</span>
              <span aria-hidden="true"> → </span><span className="sr-only"> to </span><span className="num">{formatCurrency(after)}</span>
            </li>
          )}
          {notesBefore !== undefined && notesAfter !== undefined && notesBefore !== notesAfter && (
            <li>
              Notes: <span className="sr-only">from </span>“{notesBefore}”<span aria-hidden="true"> → </span><span className="sr-only"> to </span>“{notesAfter}”
            </li>
          )}
        </ul>
      )}
      {entry.reason && <p className="history-log__reason">Reason: {entry.reason}</p>}
      {entry.action === 'delete' && <p className="history-log__reason">No reason recorded</p>}
      {entry.note && <p className="history-log__reason">Note: {entry.note}</p>}
    </li>
  );
}
