import { Link } from 'react-router';
import { Lock } from 'lucide-react';
import AdminHeader from './AdminHeader';

export default function OwnersOnly() {
  return (
    <div className="admin">
      <AdminHeader />
      <div className="admin-blocked">
        <span className="admin-blocked__icon" aria-hidden="true">
          <Lock size={32} />
        </span>
        <h2 className="title-lg">Owners only</h2>
        <p className="lead-text">
          Only the owner can manage wallets and staff. Ask the owner if something needs to change.
        </p>
      </div>
      <Link to="/more" className="btn btn--outline btn--tall admin__bottom">
        Back to More
      </Link>
    </div>
  );
}
