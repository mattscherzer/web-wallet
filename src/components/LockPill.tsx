import { Lock, LockOpen } from 'lucide-react';

interface LockPillProps {
  name?: string;
  minutesLeft?: number;
}

export default function LockPill({ name, minutesLeft }: LockPillProps) {
  const unlocked = name !== undefined && minutesLeft !== undefined;
  return (
    <span role="status" className={`lock-pill${unlocked ? ' lock-pill--unlocked' : ''}`}>
      {unlocked ? <LockOpen size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
      {unlocked ? `${name} · ${minutesLeft} min` : 'View only'}
    </span>
  );
}
