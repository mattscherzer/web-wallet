import { useState } from 'react';
import { WifiOff } from 'lucide-react';
import { CHECK_CONNECTION } from '../utils/copy';
import LoadingIndicator from './LoadingIndicator';

export default function WalletsFailed({ reload }: { reload: () => Promise<void> }) {
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
