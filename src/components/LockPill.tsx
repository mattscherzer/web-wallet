import { Lock, LockOpen } from 'lucide-react';

interface LockPillProps {
  /** Who is unlocked. Omit for view-only. */
  name?: string;
  minutesLeft?: number;
}

/** Lock state mark: "View only" or "Anna · 58 min". Not interactive. */
export default function LockPill({ name, minutesLeft }: LockPillProps) {
  const unlocked = name !== undefined && minutesLeft !== undefined;
  return (
    <span
      role="status"
      className={`lock-pill${unlocked ? ' lock-pill--unlocked' : ''}`}
    >
      {unlocked ? <LockOpen size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
      {unlocked ? `${name} · ${minutesLeft} min` : 'View only'}
    </span>
  );
}
