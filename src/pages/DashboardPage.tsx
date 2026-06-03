import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  Wallet,
  CreditCard,
  Landmark,
  Shield,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Repeat,
} from 'lucide-react';
import {
  useMainAccountsWithBalances,
  useReserveAccountsWithBalances,
  useTotalBalance,
  useRecentTransactions,
} from '../db/hooks';
import { formatCurrency, formatSignedCurrency } from '../utils/formatCurrency';
import { getAccountLabel, type Transaction, type AccountId } from '../db/database';

const ACCOUNT_ICONS: Record<string, ReactNode> = {
  cash: <Wallet size={22} />,
  paypal: <CreditCard size={22} />,
  bank: <Landmark size={22} />,
  prudent_reserve: <Shield size={22} />,
};

const ICON_CLASSES: Record<string, string> = {
  cash: 'account-card__icon--cash',
  paypal: 'account-card__icon--paypal',
  bank: 'account-card__icon--bank',
  prudent_reserve: 'account-card__icon--reserve',
};

export default function DashboardPage() {
  const mainAccounts = useMainAccountsWithBalances();
  const reserveAccounts = useReserveAccountsWithBalances();
  const totalBalance = useTotalBalance();
  const recentTransactions = useRecentTransactions(5);
  const navigate = useNavigate();

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <LayoutDashboard size={24} className="page-header__icon" />
        <h1 className="page-header__title">Dashboard</h1>
      </div>

      {/* Hero Balance Card */}
      <div className="balance-hero" id="total-balance-card">
        <p className="balance-hero__label">Total Available Balance</p>
        <p className="balance-hero__amount">{formatCurrency(totalBalance)}</p>
        <div className="balance-hero__actions">
          <button
            className="balance-hero__action"
            onClick={() => navigate('/add')}
            id="quick-deposit-btn"
          >
            <PlusCircle size={18} />
            Deposit
          </button>
          <button
            className="balance-hero__action"
            onClick={() => navigate('/transfer')}
            id="quick-transfer-btn"
          >
            <Repeat size={18} />
            Transfer
          </button>
        </div>
      </div>

      {/* Main Account Cards */}
      {mainAccounts.map((account) => (
        <div className="account-card" key={account.id} id={`account-${account.id}`}>
          <div className={`account-card__icon ${ICON_CLASSES[account.id]}`}>
            {ACCOUNT_ICONS[account.id]}
          </div>
          <div className="account-card__info">
            <p className="account-card__label">{account.name}</p>
            <p className="account-card__balance">{formatCurrency(account.balance)}</p>
          </div>
        </div>
      ))}

      {/* Reserve Accounts */}
      {reserveAccounts.length > 0 && (
        <>
          <p className="section-title" style={{ marginTop: '20px' }}>Reserve</p>
          {reserveAccounts.map((account) => (
            <div className="account-card account-card--reserve" key={account.id} id={`account-${account.id}`}>
              <div className={`account-card__icon ${ICON_CLASSES[account.id]}`}>
                {ACCOUNT_ICONS[account.id]}
              </div>
              <div className="account-card__info">
                <p className="account-card__label">{account.name}</p>
                <p className="account-card__balance">{formatCurrency(account.balance)}</p>
              </div>
              <span className="account-card__reserve-badge">Reserve</span>
            </div>
          ))}
        </>
      )}

      {/* Recent Transactions */}
      <p className="section-title" style={{ marginTop: '28px' }}>Recent Transactions</p>

      {recentTransactions.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__text">No transactions yet</p>
        </div>
      )}

      {recentTransactions.map((tx) => (
        <DashboardTransactionItem key={tx.id} transaction={tx} />
      ))}

      {recentTransactions.length > 0 && (
        <div className="view-all-link">
          <Link to="/history" id="view-all-transactions-link">View All Transactions</Link>
        </div>
      )}

      {/* FAB */}
      <button
        className="fab"
        onClick={() => navigate('/add')}
        id="fab-add-btn"
        aria-label="Add transaction"
      >
        <Plus size={24} />
      </button>
    </>
  );
}

// ─── Dashboard Transaction Item ─────────────────────────
function DashboardTransactionItem({ transaction: tx }: { transaction: Transaction }) {
  const [expanded, setExpanded] = useState(false);
  const isInflow = tx.type === 'inflow';
  const isTransfer = tx.type === 'transfer';

  const displayName = isTransfer
    ? `${getAccountLabel(tx.from_account_id as AccountId)} → ${getAccountLabel(tx.account_id)}`
    : tx.category
      ? tx.category.charAt(0).toUpperCase() + tx.category.slice(1).replace(/-/g, ' ')
      : tx.notes || 'Transaction';

  const iconClass = isTransfer
    ? 'transaction-item__icon--transfer'
    : isInflow
      ? 'transaction-item__icon--inflow'
      : 'transaction-item__icon--outflow';

  return (
    <div className="transaction-item">
      <div
        className="transaction-item__header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`transaction-item__icon ${iconClass}`}>
          {isTransfer ? <ArrowLeftRight size={20} /> : isInflow ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
        </div>
        <div className="transaction-item__info">
          <p className="transaction-item__name">{displayName}</p>
        </div>
        <span className={`transaction-item__amount ${isTransfer ? 'transaction-item__amount--transfer' : isInflow ? 'transaction-item__amount--inflow' : 'transaction-item__amount--outflow'}`}>
          {isTransfer ? formatCurrency(tx.amount) : formatSignedCurrency(tx.amount, tx.type)}
        </span>
        <span className={`transaction-item__chevron${expanded ? ' transaction-item__chevron--open' : ''}`}>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </div>

      {expanded && (
        <div className="transaction-item__details">
          {tx.account_id && (
            <div className="transaction-item__detail-row">
              <p className="transaction-item__detail-label">
                {isTransfer ? 'Destination' : 'Payment Method'}
              </p>
              <p className="transaction-item__detail-value">
                {getAccountLabel(tx.account_id)}
              </p>
            </div>
          )}
          {isTransfer && tx.from_account_id && (
            <div className="transaction-item__detail-row">
              <p className="transaction-item__detail-label">Source</p>
              <p className="transaction-item__detail-value">
                {getAccountLabel(tx.from_account_id as AccountId)}
              </p>
            </div>
          )}
          {tx.notes && (
            <div className="transaction-item__detail-row">
              <p className="transaction-item__detail-label">Notes</p>
              <p className="transaction-item__detail-value">{tx.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
