import { useHoldLockNotice } from '../auth/unlockContext';
import LoadingIndicator from './LoadingIndicator';

/** A page with no loading design of its own, while its first read is under way. */
export default function PageLoading() {
  useHoldLockNotice();
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="empty-state">
      <LoadingIndicator />
    </div>
  );
}
