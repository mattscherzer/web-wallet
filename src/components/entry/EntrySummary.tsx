import Amount from '../Amount';
import StatusChip from '../StatusChip';
import { getAccountLabel, fromAccountLabel } from '../../domain/accounts';
import { categoryLabel } from '../../domain/recordForm';
import type { Transaction } from '../../domain/transaction';

interface EntrySummaryProps {
  tx: Transaction;
}

export default function EntrySummary({ tx }: EntrySummaryProps) {
  const removed = tx.deleted;
  return (
    <>
      <h1 className="entry__amount">
        <Amount type={tx.type} amount={Number(tx.amount)} />
      </h1>
      <p className="entry__sub">
        {tx.type === 'transfer'
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
    </>
  );
}
