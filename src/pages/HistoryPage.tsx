import { useState } from 'react';
import {
  Clock,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  AlertCircle,
  History,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useFilteredTransactions } from '../db/hooks';
import {
  db,
  deleteTransaction,
  updateTransaction,
  type Transaction,
  type AuditEntry,
} from '../db/database';
import { formatSignedCurrency, formatCurrency } from '../utils/formatCurrency';
import { getDateGroupLabel, groupByDate, formatTime } from '../utils/dateHelpers';
import PinModal from '../components/PinModal';

type FilterType = 'all' | 'inflow' | 'outflow';

export default function HistoryPage() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const transactions = useFilteredTransactions(filter, searchQuery);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // PIN modal state
  const [showPin, setShowPin] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [pinTitle, setPinTitle] = useState('');

  // Edit modal state
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const grouped = groupByDate(transactions);

  const requestDelete = (id: string) => {
    setPinTitle('Confirm Delete');
    setPendingAction(() => async () => {
      await deleteTransaction(id);
      setExpandedId(null);
    });
    setShowPin(true);
  };

  const startEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditAmount(tx.amount.toString());
    setEditNotes(tx.notes);
  };

  const submitEdit = () => {
    if (!editingTx) return;
    const numAmount = parseFloat(editAmount);
    if (!numAmount || numAmount <= 0) return;

    setPinTitle('Confirm Edit');
    setPendingAction(() => async () => {
      await updateTransaction(editingTx.id, {
        amount: numAmount,
        notes: editNotes,
      });
      setEditingTx(null);
    });
    setShowPin(true);
  };

  const handlePinSuccess = async () => {
    setShowPin(false);
    if (pendingAction) {
      await pendingAction();
      setPendingAction(null);
    }
  };

  return (
    <>
      <div className="page-header">
        <Clock size={24} className="page-header__icon" />
        <h1 className="page-header__title">Transaction History</h1>
      </div>

      {/* Search */}
      <div className="search-bar" id="history-search-bar">
        <Search size={18} className="search-bar__icon" />
        <input
          type="text"
          className="search-bar__input"
          placeholder="Search transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          id="history-search-input"
        />
      </div>

      {/* Filter Pills */}
      <div className="filter-pills">
        {(['all', 'inflow', 'outflow'] as FilterType[]).map((f) => (
          <button
            key={f}
            className={`filter-pill${filter === f ? ' filter-pill--active' : ''}`}
            onClick={() => setFilter(f)}
            id={`filter-${f}`}
          >
            {f === 'all' ? 'All' : f === 'inflow' ? 'Inflows' : 'Outflows'}
          </button>
        ))}
      </div>

      {/* Transaction Groups */}
      {transactions.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__text">
            {searchQuery ? 'No matching transactions' : 'No transactions yet'}
          </p>
        </div>
      )}

      {Array.from(grouped.entries()).map(([date, txs]) => (
        <div className="date-group" key={date}>
          <div className="date-group__label">{getDateGroupLabel(date)}</div>
          {txs.map((tx) => (
            <HistoryTransactionItem
              key={tx.id}
              transaction={tx}
              isExpanded={expandedId === tx.id}
              onToggle={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
              onDelete={() => requestDelete(tx.id)}
              onEdit={() => startEdit(tx)}
            />
          ))}
        </div>
      ))}

      {/* Edit Modal */}
      {editingTx && (
        <div className="modal-overlay" onClick={() => setEditingTx(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="pin-modal__title">Edit Transaction</h2>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ marginBottom: '8px' }}>Amount</label>
              <div className="amount-input" style={{ padding: '12px' }}>
                <div className="amount-input__field">
                  <span className="amount-input__currency" style={{ fontSize: '1.25rem' }}>€</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="amount-input__value"
                    style={{ fontSize: '1.5rem' }}
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    id="edit-amount-input"
                  />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ marginBottom: '8px' }}>Notes</label>
              <textarea
                className="form-textarea"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                id="edit-notes-input"
              />
            </div>

            <button className="btn btn--primary" onClick={submitEdit} id="edit-save-btn">
              Save Changes
            </button>
            <button
              className="pin-modal__cancel"
              onClick={() => setEditingTx(null)}
              id="edit-cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <PinModal
        isOpen={showPin}
        onSuccess={handlePinSuccess}
        onCancel={() => {
          setShowPin(false);
          setPendingAction(null);
        }}
        title={pinTitle}
      />
    </>
  );
}

// ─── History Transaction Item ───────────────────────────
interface HistoryTransactionItemProps {
  transaction: Transaction;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

function HistoryTransactionItem({
  transaction: tx,
  isExpanded,
  onToggle,
  onDelete,
  onEdit,
}: HistoryTransactionItemProps) {
  const isInflow = tx.type === 'inflow';
  const wasEdited = tx.createdAt !== tx.updatedAt;

  // Live-query audit log entries for this transaction when expanded
  const auditEntries = useLiveQuery(
    async () => {
      if (!isExpanded) return [] as AuditEntry[];
      return db.auditLog
        .where('transactionId')
        .equals(tx.id)
        .sortBy('timestamp');
    },
    [tx.id, isExpanded],
    [] as AuditEntry[]
  );

  const displayName = tx.category
    ? tx.category.charAt(0).toUpperCase() + tx.category.slice(1).replace(/-/g, ' ')
    : tx.notes || 'Transaction';

  const accountLabel = tx.accountId === 'cash'
    ? 'Cash'
    : tx.accountId === 'paypal'
    ? 'PayPal'
    : 'Bank Transfer';

  const formatAuditAction = (action: string) => {
    switch (action) {
      case 'create': return 'Created';
      case 'update': return 'Edited';
      case 'delete': return 'Deleted';
      default: return action;
    }
  };

  return (
    <div className="transaction-item">
      <div className="transaction-item__header" onClick={onToggle}>
        <div className={`transaction-item__icon ${isInflow ? 'transaction-item__icon--inflow' : 'transaction-item__icon--outflow'}`}>
          {isInflow ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
        </div>
        <div className="transaction-item__info">
          <p className="transaction-item__name">
            {displayName}
            {wasEdited && (
              <span className="transaction-item__edited-badge">
                <AlertCircle size={10} />
                Edited
              </span>
            )}
          </p>
          <p className="transaction-item__time">{formatTime(tx.createdAt)}</p>
        </div>
        <span className={`transaction-item__amount ${isInflow ? 'transaction-item__amount--inflow' : 'transaction-item__amount--outflow'}`}>
          {formatSignedCurrency(tx.amount, tx.type)}
        </span>
        <span className={`transaction-item__chevron${isExpanded ? ' transaction-item__chevron--open' : ''}`}>
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </div>

      {isExpanded && (
        <div className="transaction-item__details">
          <div className="transaction-item__detail-row">
            <p className="transaction-item__detail-label">Payment Method</p>
            <p className="transaction-item__detail-value">{accountLabel}</p>
          </div>
          {tx.notes && (
            <div className="transaction-item__detail-row">
              <p className="transaction-item__detail-label">Notes</p>
              <p className="transaction-item__detail-value">{tx.notes}</p>
            </div>
          )}

          {/* Audit Log */}
          {auditEntries.length > 0 && (
            <div className="transaction-item__detail-row">
              <p className="transaction-item__detail-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <History size={12} />
                Change History
              </p>
              <div className="audit-log">
                {auditEntries.map((entry) => (
                  <div key={entry.id} className="audit-log__entry">
                    <span className="audit-log__action">
                      {formatAuditAction(entry.action)}
                    </span>
                    <span className="audit-log__time">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    {entry.action === 'update' && entry.previousData && entry.newData && (
                      <div className="audit-log__changes">
                        {entry.previousData.amount !== entry.newData.amount && (
                          <span className="audit-log__change">
                            Amount: {formatCurrency(entry.previousData.amount ?? 0)} → {formatCurrency(entry.newData.amount ?? 0)}
                          </span>
                        )}
                        {entry.previousData.notes !== entry.newData.notes && (
                          <span className="audit-log__change">
                            Notes updated
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="transaction-item__actions">
            <button
              className="transaction-item__action-btn transaction-item__action-btn--edit"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              id={`edit-tx-${tx.id}`}
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              className="transaction-item__action-btn transaction-item__action-btn--delete"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              id={`delete-tx-${tx.id}`}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
