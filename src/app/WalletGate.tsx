import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { WifiOff } from 'lucide-react';
import WelcomePage from '../pages/WelcomePage';
import { useWallet } from '../wallet/useWallet';
import LoadingIndicator from '../components/LoadingIndicator';
import { AppShellSkeleton } from '../components/LoadingSkeletons';

function WalletsFailed({ reload }: { reload: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    await reload();
    setRetrying(false);
  };
  return (
    <div className="wallet-error">
      <span className={`wallet-error__mark${retrying ? ' wallet-error__mark--busy' : ''}`} aria-hidden="true">
        {retrying ? <LoadingIndicator size={96} /> : <WifiOff size={40} />}
      </span>
      <h1 className="title-lg">Couldn’t load your wallets</h1>
      <p className="lead-text" role="alert">
        Check your connection and try again.
      </p>
      <button
        type="button"
        className="btn btn--primary btn--tall wallet-error__action"
        disabled={retrying}
        onClick={() => void retry()}
      >
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  );
}

/** Shows the app once a wallet is open; Welcome when there is none; an error with Retry if wallets could not be loaded. */
export default function WalletGate({ children }: { children: ReactNode }) {
  const { status, wallets, reload } = useWallet();
  const { pathname } = useLocation();

  if (status === 'loading') return <AppShellSkeleton />;

  if (status === 'error') return <WalletsFailed reload={reload} />;

  if (wallets.length === 0 && pathname !== '/wallets/new') return <WelcomePage />;
  return <>{children}</>;
}
