import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { REMOVE_REASONS, canRemoveEntry } from '../domain/transaction';
import { getAccountLabel, fromAccountLabel } from '../domain/accounts';
import { useEntry } from '../hooks/useEntry';
import { useTransactionCommands } from '../hooks/useTransactionCommands';
import Amount from '../components/Amount';
import EditEntrySheet from '../components/entry/EditEntrySheet';
import HistoryEvent from '../components/entry/HistoryEvent';
import ReasonSheet from '../components/ReasonSheet';
import StatusChip from '../components/StatusChip';
import { formatDate } from '../utils/dateHelpers';
import { categoryLabel } from '../domain/recordForm';
import { useAuth } from '../auth/useAuth';
import { useOwnerConfirm } from '../auth/OwnerConfirm';
import { useUnlock } from '../auth/unlockContext';
import { authorLabel } from '../domain/authorLabel';

type Sheet = 'edit' | 'remove' | null;

const CHANGE_FAILED = "Couldn't save the change. Nothing was changed.";

/** One entry: the amount, its details and the full change history, with Edit, Remove and Restore. */
export default function EntryPage() {
  const { id = '' } = useParams();
  const { status, tx, audit, refresh } = useEntry(id);
  const { user, can } = useAuth();
  const confirmOwner = useOwnerConfirm();
  const { requireUnlocked } = useUnlock();
  const { update, remove, restore } = useTransactionCommands();

  const [sheet, setSheet] = useState<Sheet>(null);
  const [problem, setProblem] = useState<string | null>(null);

  if (status === 'loading')
    return (
      <p role="status" className="empty-state__text">
        Loading…
      </p>
    );
  if (status === 'error') {
    return (
      <div className="empty-state">
        <p role="alert" className="empty-state__text">
          Couldn't load this entry. Check your connection and try again.
        </p>
        <button type="button" className="btn btn--outline" onClick={() => void refresh()}>
          Try again
        </button>
      </div>
    );
  }
  if (status === 'missing' || !tx) {
    return (
      <div className="empty-state">
        <p className="empty-state__text">Entry not found</p>
        <Link to="/history" className="btn btn--outline">
          Back to history
        </Link>
      </div>
    );
  }

  const run = async (action: () => Promise<void>) => {
    // The app may have locked while a sheet was open.
    if (!requireUnlocked()) return;
    setProblem(null);
    try {
      await action();
      setSheet(null);
      await refresh();
    } catch {
      setProblem(CHANGE_FAILED);
    }
  };

  const openEdit = () => {
    if (!requireUnlocked()) return;
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
          ? `${fromAccountLabel(tx)} → ${getAccountLabel(tx.account_id)}`
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
        <div>
          <dt>Date</dt>
          <dd>{formatDate(tx.date)}</dd>
        </div>
        <div>
          <dt>Account</dt>
          <dd>{getAccountLabel(tx.account_id)}</dd>
        </div>
        {isTransfer && tx.from_account_id && (
          <div>
            <dt>From account</dt>
            <dd>{fromAccountLabel(tx)}</dd>
          </div>
        )}
        {!isTransfer && (
          <div>
            <dt>Category</dt>
            <dd>{categoryLabel(tx.category)}</dd>
          </div>
        )}
        {tx.notes && (
          <div>
            <dt>Notes</dt>
            <dd>{tx.notes}</dd>
          </div>
        )}
      </dl>

      <h2 className="entry__heading">Change history</h2>
      <p className="entry__hint">Written automatically. It can't be edited or deleted.</p>
      <ol className="history-log" aria-label="Change history">
        {history.map((e) => (
          <HistoryEvent key={e.id} entry={e} author={authorLabel(e)} />
        ))}
      </ol>

      {problem && !sheet && (
        <p className="field-error" role="alert">
          {problem}
        </p>
      )}

      <div className="entry__toolbar" role="group" aria-label="Entry actions">
        {removed ? (
          can('restore_entry') && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() =>
                void confirmOwner().then((ok) => {
                  if (ok) return run(() => restore(tx.id));
                })
              }
            >
              <RotateCcw size={18} aria-hidden="true" /> Restore
            </button>
          )
        ) : (
          <>
            <button type="button" className="btn btn--outline" onClick={openEdit}>
              <Pencil size={18} aria-hidden="true" /> Edit
            </button>
            {canRemoveEntry({ can, userId: user?.id, tx }) && (
              <button
                type="button"
                className="btn btn--outline entry__remove"
                onClick={() => {
                  if (!requireUnlocked()) return;
                  setProblem(null);
                  setSheet('remove');
                }}
              >
                <Trash2 size={18} aria-hidden="true" /> Remove
              </button>
            )}
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
          onConfirm={(reason, note) => void run(() => remove(tx.id, reason, note))}
        >
          <p className="sheet__text">
            It stops counting in balances and reports. It stays in the history and can be restored.
          </p>
        </ReasonSheet>
      )}

      {sheet === 'edit' && (
        <EditEntrySheet
          tx={tx}
          error={problem}
          onCancel={() => setSheet(null)}
          onSave={(updates, reason) => void run(() => update(tx.id, updates, reason))}
        />
      )}
    </div>
  );
}
