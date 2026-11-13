import { useState } from 'react';
import { Link } from 'react-router';
import { Download, Search } from 'lucide-react';
import { HistorySkeleton } from '../components/LoadingSkeletons';
import NotLoaded from '../components/NotLoaded';
import { useFilteredTransactionsState } from '../hooks/useHistory';
import { getAccountLabel } from '../domain/accounts';
import { entryTitle, historyTotals, type Transaction } from '../domain/transaction';
import Amount from '../components/Amount';
import StatusChip from '../components/StatusChip';
import TransactionIcon from '../components/TransactionIcon';
import { formatCurrency, formatSignedCurrency } from '../utils/formatCurrency';
import { getDateGroupLabel, groupByDate } from '../utils/dateHelpers';
import { exportHistory } from '../hooks/exportHistory';
import { availableDelta } from '../domain/recordForm';
import { useWallet } from '../wallet/useWallet';
import { useAuth } from '../auth/useAuth';
import { useOwnerConfirm } from '../auth/OwnerConfirm';

type FilterType = 'all' | 'inflow' | 'outflow' | 'transfer';

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All',
  inflow: 'Money in',
  outflow: 'Money out',
  transfer: 'Transfer',
};

export default function HistoryPage() {
  const { current: wallet } = useWallet();
  const { can } = useAuth();
  const confirmOwner = useOwnerConfirm();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRemoved, setShowRemoved] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const { transactions, loaded, failed, refresh } = useFilteredTransactionsState(filter, searchQuery, showRemoved);
  const grouped = groupByDate(transactions);

  const totals = historyTotals(transactions);

  return (
    <>
      <div className="page-header">
        <h1 className="page-header__title">History</h1>
        {can('export') && (
          <button
            className="btn btn--outline page-header__action"
            onClick={() => {
              if (!wallet) return;
              setExportFailed(false);
              void confirmOwner()
                .then((ok) => (ok ? exportHistory(wallet.id, wallet.name) : undefined))
                .catch(() => setExportFailed(true));
            }}
            id="export-csv-btn"
          >
            <Download size={18} aria-hidden="true" /> Export CSV
          </button>
        )}
      </div>

      {exportFailed && (
        <p role="alert" className="form-error">
          Couldn't export the history. Check your connection and try again.
        </p>
      )}

      {!loaded && (
        <NotLoaded failed={failed} what="the history" onRetry={() => void refresh()} skeleton={<HistorySkeleton />} />
      )}
      {loaded && (
        <>
          <div className="search-bar" id="history-search-bar">
            <Search size={18} className="search-bar__icon" aria-hidden="true" />
            <input
              type="search"
              className="search-bar__input"
              placeholder="Search history"
              aria-label="Search history"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="history-search-input"
            />
          </div>

          <div className="filter-pills">
            {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`filter-pill${filter === f ? ' filter-pill--active' : ''}`}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                id={`filter-${f}`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
            <button
              type="button"
              className={`filter-pill${showRemoved ? ' filter-pill--active' : ''}`}
              aria-pressed={showRemoved}
              onClick={() => setShowRemoved((v) => !v)}
              id="filter-removed"
            >
              Removed
            </button>
          </div>

          {totals.count > 0 && (
            <p className="history-summary num">
              {totals.count} {totals.count === 1 ? 'entry' : 'entries'} · in{' '}
              {formatSignedCurrency(totals.inflow, 'inflow')} · out {formatSignedCurrency(totals.outflow, 'outflow')}
            </p>
          )}

          {transactions.length === 0 && (
            <div className="empty-state">
              <p className="empty-state__text">{searchQuery ? 'No matching entries' : 'No entries yet'}</p>
              {!searchQuery && (
                <>
                  <p className="empty-state__hint">
                    Money in, money out and transfers you record appear here, newest first.
                  </p>
                  <Link to="/record?type=in" className="btn btn--primary">
                    Record money in
                  </Link>
                </>
              )}
            </div>
          )}

          {Array.from(grouped.entries()).map(([date, txs]) => (
            <div className="date-group" key={date}>
              <div className="date-group__label">{getDateGroupLabel(date)}</div>
              <div className="segmented-list">
                {txs.map((tx) => (
                  <HistoryRow key={tx.id} tx={tx} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function HistoryRow({ tx }: { tx: Transaction }) {
  const isTransfer = tx.type === 'transfer';
  const wasEdited = tx.created_at !== tx.updated_at && !tx.deleted;
  const title = entryTitle(tx, 'Entry');
  const where = isTransfer ? '' : `${tx.type === 'inflow' ? 'Into' : 'From'} ${getAccountLabel(tx.account_id)}`;
  const meta = [where, tx.notes].filter(Boolean).join(' · ');

  const delta = isTransfer
    ? availableDelta({
        type: 'transfer',
        amount: Number(tx.amount),
        accountId: tx.account_id,
        fromAccountId: tx.from_account_id,
      })
    : null;

  return (
    <div className={`transaction-item${tx.deleted ? ' transaction-item--removed' : ''}`}>
      <Link to={`/history/${tx.id}`} className="transaction-item__header">
        <TransactionIcon type={tx.type} />
        <div className="transaction-item__info">
          <p className="transaction-item__name">
            {title}
            {wasEdited && <StatusChip variant="edited" />}
            {tx.deleted && <StatusChip variant="removed" />}
          </p>
          {meta && <p className="transaction-item__time">{meta}</p>}
          {delta !== null && (
            <p className="transaction-item__time">
              {delta === 0 ? 'Available unchanged' : `Available ${formatCurrency(delta)}`}
            </p>
          )}
        </div>
        <span className="transaction-item__amount">
          <Amount type={tx.type} amount={Number(tx.amount)} />
        </span>
      </Link>
    </div>
  );
}
