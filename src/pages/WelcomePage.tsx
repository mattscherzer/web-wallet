import { Link } from 'react-router';
import { Lock, Plus } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

/** First run: this device has no wallet yet. */
export default function WelcomePage() {
  const { profile, signOut } = useAuth();
  if (profile && profile.kind !== 'owner') {
    return (
      <div className="welcome welcome--staff">
        <div className="welcome__brand">
          <span className="welcome__brand-mark" aria-hidden="true">
            <Lock size={28} />
          </span>
          <span className="welcome__brand-name">Treasury</span>
        </div>
        <h1 className="title-lg">No wallet yet</h1>
        <p className="lead-text">You aren’t a member of any wallet yet. Ask the owner to add you.</p>
        <button type="button" className="btn btn--outline btn--tall welcome__bottom" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }
  return (
    <div className="welcome">
      <div className="welcome__hero">
        <img className="welcome__icon" src="/icon-192.png" alt="" width={96} height={96} />
        <h1 className="welcome__title">Keep your group’s books, together</h1>
        <p className="welcome__text">
          You don’t have a wallet yet. A wallet is one group’s money: its accounts, categories, staff and full history.
        </p>
      </div>
      <Link to="/wallets/new" className="btn btn--primary welcome__action">
        <Plus size={20} aria-hidden="true" /> Create a wallet
      </Link>
      <p className="welcome__sub welcome__bottom">
        Staff don’t create wallets. The owner adds you with a username and a PIN.
      </p>
    </div>
  );
}
