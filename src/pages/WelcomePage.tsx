import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

/** First run: this device has no wallet yet. */
export default function WelcomePage() {
  return (
    <div className="welcome">
      <div className="welcome__hero">
        <h1 className="welcome__title">Keep your group’s books, together</h1>
        <p className="welcome__text">
          You don’t have a wallet yet. A wallet is one group’s money: its accounts, categories and full history.
        </p>
      </div>
      <Link to="/wallets/new" className="btn btn--primary welcome__action">
        <Plus size={20} aria-hidden="true" /> Create a wallet
      </Link>
    </div>
  );
}
