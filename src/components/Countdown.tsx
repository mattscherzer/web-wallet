import { useCountdown } from '../hooks/useCountdown';

export default function Countdown({ seconds, onDone }: { seconds: number; onDone?: () => void }) {
  const left = useCountdown(seconds, onDone);
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return (
    <span className="countdown" role="timer" aria-label={`Try again in ${minutes} minute${minutes === 1 ? '' : 's'}`}>
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </span>
  );
}
