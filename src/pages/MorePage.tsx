import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { useUnlock } from '../auth/unlockContext';

export default function MorePage() {
  const { profile, user, lock, signOut } = useAuth();
  const { locked, openUnlock } = useUnlock();
  return (
    <>
      <div className="page-header">
        <h1 className="page-header__title">More</h1>
      </div>
      {profile && (
        <section className="signed-in-card" aria-label="Signed in">
          <span className="wallet-avatar" aria-hidden="true">
            {profile.displayName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="signed-in-card__name">{profile.displayName}</p>
            <p className="signed-in-card__detail">
              {profile.kind === 'owner' ? `Owner · ${user?.email ?? ''}` : 'Staff · PIN sign-in'}
            </p>
          </div>
        </section>
      )}
      <div className="more-actions">
        {locked ? (
          <button type="button" className="btn btn--primary" onClick={openUnlock}>
            Unlock
          </button>
        ) : (
          <button type="button" className="btn btn--outline" onClick={() => void lock()}>
            Lock
          </button>
        )}
        <button type="button" className="btn btn--outline" onClick={() => void signOut()}>
          Sign out of this phone
        </button>
      </div>
      {profile?.kind === 'owner' && (
        <Link to="/admin" className="btn btn--outline">
          Wallets and staff
        </Link>
      )}
    </>
  );
}
