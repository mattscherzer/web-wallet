import type { ReactNode } from 'react';
import LoadFailed from './LoadFailed';

/** What a page shows while its first read has not succeeded: the retry if it failed, otherwise its loading design. */
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
