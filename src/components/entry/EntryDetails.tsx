import { getAccountLabel, fromAccountLabel } from '../../domain/accounts';
import { categoryLabel } from '../../domain/recordForm';
import type { Transaction } from '../../domain/transaction';
import { formatDate } from '../../utils/dateHelpers';

interface EntryDetailsProps {
  tx: Transaction;
}

export default function EntryDetails({ tx }: EntryDetailsProps) {
  const isTransfer = tx.type === 'transfer';
  return (
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
  );
}
