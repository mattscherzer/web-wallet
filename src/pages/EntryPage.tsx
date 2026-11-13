import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { REMOVE_REASONS, canRemoveEntry } from '../domain/transaction';
import { useEntry } from '../hooks/useEntry';
import { useTransactionCommands } from '../hooks/useTransactionCommands';
import EditEntrySheet from '../components/entry/EditEntrySheet';
import EntryActions from '../components/entry/EntryActions';
import EntryDetails from '../components/entry/EntryDetails';
import EntrySummary from '../components/entry/EntrySummary';
import HistoryEvent from '../components/entry/HistoryEvent';
import FormError from '../components/FormError';
import LoadFailed from '../components/LoadFailed';
import PageLoading from '../components/PageLoading';
import ReasonSheet from '../components/ReasonSheet';
import { useAuth } from '../auth/useAuth';
import { useOwnerConfirm } from '../auth/OwnerConfirm';
import { useUnlock } from '../auth/unlockContext';
import { authorLabel } from '../domain/authorLabel';

type Sheet = 'edit' | 'remove' | null;

const CHANGE_FAILED = "Couldn't save the change. Nothing was changed.";

export default function EntryPage() {
  const { id = '' } = useParams();
  const { status, tx, audit, refresh } = useEntry(id);
  const { user, can } = useAuth();
  const confirmOwner = useOwnerConfirm();
  const { requireUnlocked } = useUnlock();
  const { update, remove, restore } = useTransactionCommands();

  const [sheet, setSheet] = useState<Sheet>(null);
  const [problem, setProblem] = useState<string | null>(null);

  if (status === 'loading') return <PageLoading />;
  if (status === 'error') return <LoadFailed what="this entry" onRetry={() => void refresh()} />;
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

  const history = [...audit].reverse();

  return (
    <div className="entry">
      <Link to="/history" className="entry__back">
        <ArrowLeft size={20} aria-hidden="true" /> Back to history
      </Link>

      <EntrySummary tx={tx} />

      <EntryDetails tx={tx} />

      <h2 className="entry__heading">Change history</h2>
      <p className="entry__hint">Written automatically. It can't be edited or deleted.</p>
      <ol className="history-log" aria-label="Change history">
        {history.map((e) => (
          <HistoryEvent key={e.id} entry={e} author={authorLabel(e)} />
        ))}
      </ol>

      {problem && !sheet && <FormError>{problem}</FormError>}

      <EntryActions
        removed={tx.deleted}
        canRestore={can('restore_entry')}
        canRemove={canRemoveEntry({ can, userId: user?.id, tx })}
        onEdit={openEdit}
        onRemove={() => {
          if (!requireUnlocked()) return;
          setProblem(null);
          setSheet('remove');
        }}
        onRestore={() =>
          void confirmOwner().then((ok) => {
            if (ok) return run(() => restore(tx.id));
          })
        }
      />

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
