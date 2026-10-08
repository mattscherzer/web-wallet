import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { getAccountLabel, removeTransaction, type AccountId } from '../db/database';
import { useEntry } from '../db/hooks';
import Amount from '../components/Amount';
import PinModal from '../components/PinModal';
import { formatDate, formatTime } from '../utils/dateHelpers';
import { categoryLabel, typeParam } from '../utils/recordForm';
import { useWallet } from '../wallet/useWallet';

/** Receipt shown right after saving: what was recorded, with Record another, Done and Undo. */
export default function RecordedPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { current: wallet } = useWallet();
  const { status, tx } = useEntry(id);
  const [showPin, setShowPin] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (status === 'loading') return <p role="status" className="empty-state__text">Loading…</p>;
  if (status === 'error') return <p role="alert" className="field-error">Couldn't load this entry. Check your connection and try again.</p>;
  if (status === 'missing' || !tx) return <p className="empty-state__text">Entry not found</p>;

  const undo = async () => {
    setShowPin(false);
    if (!wallet) return;
    try {
      await removeTransaction(tx.id, { walletId: wallet.id, reason: 'Entered by mistake' });
      navigate('/');
    } catch {
      setProblem("Couldn't undo this entry. Nothing was changed.");
    }
  };

  const isTransfer = tx.type === 'transfer';
  return (
    <div className="recorded">
      <div className="recorded__burst" aria-hidden="true"><Check size={40} /></div>
      <h1 className="recorded__title">Recorded</h1>
      <p className="recorded__sub">Saved to the group's books.</p>

      <div className="receipt">
        <p className="receipt__amount"><Amount type={tx.type} amount={Number(tx.amount)} /></p>
        <dl className="detail-list">
          {isTransfer && (
            <div><dt>From</dt><dd>{getAccountLabel(tx.from_account_id as AccountId)}</dd></div>
          )}
          <div><dt>{isTransfer ? 'To' : tx.type === 'inflow' ? 'Into' : 'From'}</dt><dd>{getAccountLabel(tx.account_id)}</dd></div>
          {!isTransfer && <div><dt>Category</dt><dd>{categoryLabel(tx.category)}</dd></div>}
          <div><dt>Date</dt><dd>{formatDate(tx.date)}</dd></div>
          {tx.notes && <div><dt>Notes</dt><dd>{tx.notes}</dd></div>}
          <div><dt>Recorded</dt><dd>at {formatTime(tx.created_at)}</dd></div>
        </dl>
      </div>

      {problem && <p className="field-error" role="alert">{problem}</p>}
      <div className="recorded__actions">
        <Link className="btn btn--primary" to={`/record?type=${typeParam(tx.type)}`}>Record another</Link>
        <Link className="btn btn--outline" to="/">Done</Link>
        <button type="button" className="btn recorded__undo" onClick={() => setShowPin(true)}>Undo this entry</button>
      </div>

      <PinModal isOpen={showPin} onSuccess={undo} onCancel={() => setShowPin(false)} title="Confirm undo" />
    </div>
  );
}
