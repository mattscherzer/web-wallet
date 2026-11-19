import { useEffect, useRef, useState } from 'react';

export function useCountdown(seconds: number, onDone?: () => void) {
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
  return left;
}
