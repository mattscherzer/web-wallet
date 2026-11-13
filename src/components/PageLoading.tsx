import { useHoldLockNotice } from '../auth/unlockContext';
import LoadingIndicator from './LoadingIndicator';

export default function PageLoading() {
  useHoldLockNotice();
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="empty-state">
      <LoadingIndicator />
    </div>
  );
}
