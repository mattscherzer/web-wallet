import type { ReactNode } from 'react';
import LoadFailed from './LoadFailed';

export default function NotLoaded({
  failed,
  what,
  onRetry,
  skeleton,
}: {
  failed: boolean;
  what: string;
  onRetry: () => void;
  skeleton: ReactNode;
}) {
  return failed ? <LoadFailed what={what} onRetry={onRetry} /> : skeleton;
}
