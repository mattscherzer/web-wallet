import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function MorePage() {
  const { profile, signOut } = useAuth();
  return (
    <>
      <div className="page-header">
        <h1 className="page-header__title">More</h1>
      </div>
      {profile && <p className="entry__hint">Signed in as {profile.displayName}</p>}
      {profile?.isAdmin && (
        <Link to="/admin" className="btn btn--outline">
          Admin
        </Link>
      )}
      <button type="button" className="btn btn--outline" onClick={() => void signOut()}>
        Sign out
      </button>
    </>
  );
}
