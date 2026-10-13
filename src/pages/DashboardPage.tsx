import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Coins,
  QrCode,
  PiggyBank,
  ReceiptEuro,
    HandCoins
} from 'lucide-react';
import { useBalanceSummary, useRecentTransactions } from '../db/hooks';
import Amount from '../components/Amount';
import { formatCurrency } from '../utils/formatCurrency';
import {
    getAccountLabel,
    type Transaction,
    type AccountId
} from '../db/database';

const ACCOUNT_ICONS: Record<string, ReactNode> = {
    cash: <Coins size={22} />,
    paypal: <QrCode size={22} />,
    bank: <CreditCard size={22} />,
    prudent_reserve: <PiggyBank size={22} />
};

const ICON_CLASSES: Record<string, string> = {
  cash: 'account-card__icon--cash',
  paypal: 'account-card__icon--paypal',
  bank: 'account-card__icon--bank',
    prudent_reserve: 'account-card__icon--reserve'
};

export default function DashboardPage() {
    const {
        main: mainAccounts,
        reserve: reserveAccounts,
        spendableTotal,
        grandTotal
    } = useBalanceSummary();
  const recentTransactions = useRecentTransactions(5);

  return (
      <>
          {/* Hero Balance Card */}
          <div className="balance-hero" id="total-balance-card">
              <p className="balance-hero__label">Available to spend</p>
              <p className="balance-hero__amount">
                    {formatCurrency(spendableTotal)}
              </p>
                <p className="balance-hero__total">
                    Available in total: {formatCurrency(grandTotal)}
              </p>
          </div>

          {/* Main Account Cards */}
          <p className="section-title">Accounts</p>
          <div className="segmented-list">
              {mainAccounts.map(account => (
                  <div
                      className="account-card"
                      key={account.id}
                      id={`account-${account.id}`}
                  >
                      <div
                          className={`account-card__icon ${ICON_CLASSES[account.id]}`}
                      >
                          {ACCOUNT_ICONS[account.id]}
                      </div>
                      <div className="account-card__info">
                            <p className="account-card__label">
                                {account.name}
                            </p>
                          <p className="account-card__balance">
                              {formatCurrency(account.balance)}
                          </p>
                      </div>
                  </div>
              ))}
          </div>

          {/* Reserve Accounts */}
          {reserveAccounts.length > 0 && (
              <>
                  {reserveAccounts.map(account => (
                      <div
                          className="account-card account-card--reserve"
                          key={account.id}
                          id={`account-${account.id}`}
                      >
                          <div
                              className={`account-card__icon ${ICON_CLASSES[account.id]}`}
                          >
                              {ACCOUNT_ICONS[account.id]}
                          </div>
                          <div className="account-card__info">
                                <div>
                                  <p className="account-card__label">
                                      {account.name}
                                  </p>
                                    <p className="account-card__note">
                                      Not available for spending
                                  </p>
                              </div>
                              <p className="account-card__balance">
                                  {formatCurrency(account.balance)}
                              </p>
                          </div>
                      </div>
                  ))}
              </>
          )}

          {/* Recent Transactions */}
            <div className="section-header">
              <p className="section-title">Recent Activity</p>
              {recentTransactions.length > 0 && (
                  <div className="see-all-link">
                      <Link to="/history" id="see-all-link">
                          See all
                      </Link>
                  </div>
              )}
          </div>

          {recentTransactions.length === 0 && (
              <div className="empty-state">
                  <p className="empty-state__text">No transactions yet</p>
              </div>
          )}

          <div className="segmented-list">
              {recentTransactions.map(tx => (
                  <DashboardTransactionItem key={tx.id} transaction={tx} />
              ))}
          </div>
      </>
  );
}

// ─── Dashboard Transaction Item ─────────────────────────
function DashboardTransactionItem({
    transaction: tx
}: {
    transaction: Transaction;
}) {
  const [expanded, setExpanded] = useState(false);
  const isInflow = tx.type === 'inflow';
  const isTransfer = tx.type === 'transfer';

  const displayName = isTransfer
    ? `${getAccountLabel(tx.from_account_id as AccountId)} → ${getAccountLabel(tx.account_id)}`
    : tx.category
          ? tx.category.charAt(0).toUpperCase() +
            tx.category.slice(1).replace(/-/g, ' ')
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
                  {isTransfer ? (
                      <ArrowLeftRight size={20} />
                  ) : isInflow ? (
                      <HandCoins size={20} />
                  ) : (
                      <ReceiptEuro size={20} />
                  )}
              </div>
              <div className="transaction-item__info">
                  <p className="transaction-item__name">{displayName}</p>
              </div>
              <span className="transaction-item__amount">
                  <Amount type={tx.type} amount={tx.amount} />
              </span>
              <span
                    className={`transaction-item__chevron${expanded ? ' transaction-item__chevron--open' : ''}`}
              >
                  {expanded ? (
                      <ChevronUp size={18} />
                  ) : (
                      <ChevronDown size={18} />
                  )}
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
                          <p className="transaction-item__detail-label">
                              Source
                          </p>
                          <p className="transaction-item__detail-value">
                                {getAccountLabel(
                                    tx.from_account_id as AccountId
                                )}
                          </p>
                      </div>
                  )}
                  {tx.notes && (
                      <div className="transaction-item__detail-row">
                          <p className="transaction-item__detail-label">
                              Notes
                          </p>
                          <p className="transaction-item__detail-value">
                              {tx.notes}
                          </p>
                      </div>
                  )}
              </div>
          )}
      </div>
  );
}
