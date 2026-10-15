import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth';

export default function MorePage() {
  const { profile, lock } = useAuth();
  return (
    <>
      <div className="page-header">
        <h1 className="page-header__title">More</h1>
      </div>
      {profile && (
        <p className="entry__hint">
          Signed in as {profile.displayName} ({profile.kind})
        </p>
      )}
      {profile?.kind === 'owner' && (
        <Link to="/admin" className="btn btn--outline">
          Wallets and staff
        </Link>
      )}
      <button type="button" className="btn btn--outline" onClick={() => void lock()}>
        Lock
      </button>
    </>
  );
}
