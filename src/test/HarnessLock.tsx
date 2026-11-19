import { useAuth } from '../auth/useAuth';
import { useUnlock } from '../auth/unlockContext';

export function HarnessLock() {
  const { lock } = useAuth();
  const { locked } = useUnlock();
  return (
    <button type="button" onClick={() => void lock()}>
      {locked ? 'Harness: locked' : 'Harness: lock'}
    </button>
  );
}
