import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Download, Search } from 'lucide-react';
import { useFilteredTransactions } from '../db/hooks';
import { getAccountLabel, type AccountId, type Transaction } from '../db/database';
import Amount from '../components/Amount';
import StatusChip from '../components/StatusChip';
import { formatCurrency, formatSignedCurrency } from '../utils/formatCurrency';
import { getDateGroupLabel, groupByDate } from '../utils/dateHelpers';
import { generateHistoryCsv } from '../utils/exportCsv';
import { availableDelta, categoryLabel } from '../utils/recordForm';
import { useWallet } from '../wallet/useWallet';

type FilterType = 'all' | 'inflow' | 'outflow' | 'transfer';

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All',
  inflow: 'Money in',
  outflow: 'Money out',
  transfer: 'Transfer',
};

export default function HistoryPage() {
  const { current: wallet } = useWallet();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRemoved, setShowRemoved] = useState(false);
  const transactions = useFilteredTransactions(filter, searchQuery, showRemoved);
  const grouped = groupByDate(transactions);

  const live = transactions.filter((t) => !t.deleted);
  const total = (type: 'inflow' | 'outflow') =>
    live.filter((t) => t.type === type).reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <>
      <div className="page-header">
        <h1 className="page-header__title">History</h1>
        <button
          className="btn btn--outline page-header__action"
          onClick={() => wallet && generateHistoryCsv(wallet.id, wallet.name)}
          id="export-csv-btn"
        >
          <Download size={18} aria-hidden="true" /> Export CSV
        </button>
      </div>

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

      {live.length > 0 && (
        <p className="history-summary num">
          {live.length} {live.length === 1 ? 'entry' : 'entries'} · in {formatSignedCurrency(total('inflow'), 'inflow')} · out {formatSignedCurrency(total('outflow'), 'outflow')}
        </p>
      )}

      {transactions.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__text">{searchQuery ? 'No matching entries' : 'No entries yet'}</p>
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
  );
}

function HistoryRow({ tx }: { tx: Transaction }) {
  const isTransfer = tx.type === 'transfer';
  const wasEdited = tx.created_at !== tx.updated_at && !tx.deleted;
  const title = isTransfer
    ? `${getAccountLabel(tx.from_account_id as AccountId)} → ${getAccountLabel(tx.account_id)}`
    : categoryLabel(tx.category) || 'Entry';
  const where = isTransfer ? '' : `${tx.type === 'inflow' ? 'Into' : 'From'} ${getAccountLabel(tx.account_id)}`;
  const meta = [where, tx.notes].filter(Boolean).join(' · ');

  const delta = isTransfer
    ? availableDelta({ type: 'transfer', amount: Number(tx.amount), accountId: tx.account_id, fromAccountId: tx.from_account_id })
    : null;

  const iconClass = isTransfer
    ? 'transaction-item__icon--transfer'
    : tx.type === 'inflow'
      ? 'transaction-item__icon--inflow'
      : 'transaction-item__icon--outflow';

  return (
    <div className={`transaction-item${tx.deleted ? ' transaction-item--removed' : ''}`}>
      <Link to={`/history/${tx.id}`} className="transaction-item__header">
        <div className={`transaction-item__icon ${iconClass}`} aria-hidden="true">
          {isTransfer ? <ArrowLeftRight size={20} /> : tx.type === 'inflow' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
        </div>
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
