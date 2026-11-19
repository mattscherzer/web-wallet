import { useEffect, useState } from 'react';

/** False until `ms` have passed since mount, then true. */
export function useElapsed(ms: number) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return elapsed;
}
