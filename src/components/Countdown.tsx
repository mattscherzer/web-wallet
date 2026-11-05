import { useEffect, useRef, useState } from 'react';

/** `m:ss` left until `seconds` from mount have passed, counting down once a second. `onDone` runs once at 0:00. */
export default function Countdown({ seconds, onDone }: { seconds: number; onDone?: () => void }) {
  const [deadline] = useState(() => Date.now() + seconds * 1000);
  const [left, setLeft] = useState(seconds);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const tick = setInterval(() => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 1000);
    return () => clearInterval(tick);
  }, [deadline]);
  useEffect(() => {
    if (left === 0) done.current?.();
  }, [left]);
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return (
    <span className="countdown" role="timer" aria-label={`Try again in ${minutes} minute${minutes === 1 ? '' : 's'}`}>
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </span>
  );
}
