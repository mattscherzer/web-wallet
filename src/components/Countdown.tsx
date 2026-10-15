import { useEffect, useState } from 'react';

/** `m:ss` left until `seconds` from mount have passed, counting down once a second. */
export default function Countdown({ seconds, label }: { seconds: number; label?: string }) {
  const [deadline] = useState(() => Date.now() + seconds * 1000);
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const tick = setInterval(() => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 1000);
    return () => clearInterval(tick);
  }, [deadline]);
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return (
    <span
      className="countdown"
      role="timer"
      aria-label={label ?? `Try again in ${minutes} minute${minutes === 1 ? '' : 's'}`}
    >
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </span>
  );
}
