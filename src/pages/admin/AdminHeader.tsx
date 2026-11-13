import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

export default function AdminHeader() {
  return (
    <div className="page-header page-header--back">
      <Link to="/more" className="icon-btn" aria-label="Back">
        <ArrowLeft size={24} aria-hidden="true" />
      </Link>
      <h1 className="page-header__title">Wallets and staff</h1>
    </div>
  );
}
