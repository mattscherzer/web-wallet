import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import WelcomePage from '../pages/WelcomePage';
import { useWallet } from './useWallet';

/** Shows the app once a wallet is open; Welcome when there is none; an error with Retry if wallets could not be loaded. */
export default function WalletGate({ children }: { children: ReactNode }) {
  const { status, wallets, reload } = useWallet();
  const { pathname } = useLocation();

  if (status === 'loading') {
    return (
      <div className="route-fallback" role="status" aria-label="Loading">
        <span className="route-fallback__spinner" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="wallet-error" role="alert">
        <p>Couldn’t load your wallets.</p>
        <button type="button" className="btn btn--primary" onClick={reload}>Retry</button>
      </div>
    );
  }

  if (wallets.length === 0 && pathname !== '/wallets/new') return <WelcomePage />;
  return <>{children}</>;
}
