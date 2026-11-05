import { Link } from 'react-router';
import { Lock, LockOpen } from 'lucide-react';
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
          <span className="signed-in-card__avatar" aria-hidden="true">
            {profile.displayName.slice(0, 1).toUpperCase()}
          </span>
          <div className="signed-in-card__who">
            <p className="signed-in-card__name">{profile.displayName}</p>
            <p className="signed-in-card__detail">
              {profile.kind === 'owner' ? `Owner · ${user?.email ?? ''}` : 'Staff · PIN sign-in'}
            </p>
          </div>
          <button
            type="button"
            className="signed-in-card__lock"
            onClick={locked ? openUnlock : () => void lock()}
          >
            {locked ? <LockOpen size={20} aria-hidden="true" /> : <Lock size={20} aria-hidden="true" />}
            {locked ? 'Unlock' : 'Lock'}
          </button>
        </section>
      )}
      <button type="button" className="more-signout" onClick={() => void signOut()}>
        Sign out of this phone
      </button>
      {profile?.kind === 'owner' && (
        <Link to="/admin" className="btn btn--outline">
          Wallets and staff
        </Link>
      )}
    </>
  );
}
