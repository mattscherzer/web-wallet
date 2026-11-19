import { WifiOff } from 'lucide-react';
import { useHoldLockNotice } from '../auth/unlockContext';
import { useRetry } from '../hooks/useRetry';
import { CHECK_CONNECTION } from '../utils/copy';
import LoadingIndicator from './LoadingIndicator';

export default function WalletsFailed({ reload }: { reload: () => Promise<void> }) {
  useHoldLockNotice();
  const { retrying, retry } = useRetry(reload);
  return (
    <div className="wallet-error">
      <span className={`wallet-error__mark${retrying ? ' wallet-error__mark--busy' : ''}`} aria-hidden="true">
        {retrying ? <LoadingIndicator /> : <WifiOff size={40} />}
      </span>
      <h1 className="title-lg">Couldn’t load your wallets</h1>
      <p className="lead-text" role="alert">
        {CHECK_CONNECTION}
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
