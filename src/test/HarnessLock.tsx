import { useAuth } from '../auth/useAuth';
import { useUnlock } from '../auth/unlockContext';

// Only Overview and More have a lock control in the app; this stands in for it on the other pages.
export function HarnessLock() {
  const { lock } = useAuth();
  const { locked } = useUnlock();
  return (
    <button type="button" onClick={() => void lock()}>
      {locked ? 'Harness: locked' : 'Harness: lock'}
    </button>
  );
}
