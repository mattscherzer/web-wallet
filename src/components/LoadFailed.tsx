import { useHoldLockNotice } from '../auth/unlockContext';
import { couldnt } from '../utils/copy';

export default function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  useHoldLockNotice();
  return (
    <div className="empty-state">
      <p role="alert" className="empty-state__text">
        {couldnt(`load ${what}`)}
      </p>
      <button type="button" className="btn btn--outline" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
