import { Link } from 'react-router';
import { ChevronRight, Lock, LockOpen, Shield } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { useUnlock } from '../auth/unlockContext';
import { MAIN_ACCOUNTS, RESERVE_ACCOUNTS, type Account } from '../domain/accounts';
import { useLoadedAccountBalances } from '../hooks/useBalances';
import { formatCurrency } from '../utils/formatCurrency';

export default function MorePage() {
  const { profile, user, lock, signOut } = useAuth();
  const { locked, openUnlock } = useUnlock();
  const balances = useLoadedAccountBalances();
  const isOwner = profile?.kind === 'owner';

  const accountRow = (a: Account) => (
    <li key={a.id}>
      <Link to="/history" className={`list-row list-row--link${a.isReserve ? ' list-row--reserve' : ''}`}>
        {a.isReserve && (
          <span className="more-reserve-icon" aria-hidden="true">
            <Shield size={20} />
          </span>
        )}
        <span className="list-row__text">
          <span className="list-row__name">{a.name}</span>
          {a.isReserve && <span className="list-row__sub">Set aside, not available</span>}
        </span>
        {balances ? (
          <span className="list-row__value">{formatCurrency(balances[a.id] ?? 0)}</span>
        ) : (
          <span className="skeleton more-skeleton-amount" aria-hidden="true" />
        )}
        <ChevronRight size={20} className="list-row__chevron" aria-hidden="true" />
      </Link>
    </li>
  );

  return (
    <>
      <div className="page-header">
        <h1 className="page-header__title">More</h1>
      </div>

      {profile && (
        <div className="more-id">
          <span className="wallet-avatar wallet-avatar--current" aria-hidden="true">
            {profile.displayName.slice(0, 1).toUpperCase()}
          </span>
          <span className="list-row__text">
            <span className="list-row__name">{profile.displayName}</span>
            <span className="list-row__sub">{isOwner ? `Owner · ${user?.email ?? ''}` : 'Staff · PIN sign-in'}</span>
          </span>
          <button
            type="button"
            className="btn btn--outline more-id__lock"
            onClick={locked ? openUnlock : () => void lock()}
          >
            {locked ? <LockOpen size={20} aria-hidden="true" /> : <Lock size={20} aria-hidden="true" />}
            {locked ? 'Unlock' : 'Lock'}
          </button>
        </div>
      )}
      <button type="button" className="link-btn more-signout" onClick={() => void signOut()}>
        Sign out of this phone
      </button>

      <h2 className="section-title">Operating · counts toward Available</h2>
      <ul className="card-list">{MAIN_ACCOUNTS.map(accountRow)}</ul>

      <h2 className="section-title">Reserve</h2>
      <ul className="card-list">{RESERVE_ACCOUNTS.map(accountRow)}</ul>

      {isOwner && (
        <>
          <h2 className="section-title">Group</h2>
          <ul className="card-list">
            <li>
              <Link to="/admin" className="list-row list-row--link">
                <span className="list-row__text">
                  <span className="list-row__name">Wallets and staff</span>
                </span>
                <span className="list-row__sub">Owner only</span>
                <ChevronRight size={20} className="list-row__chevron" aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </>
      )}
    </>
  );
}
