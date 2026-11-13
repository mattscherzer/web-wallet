import { useState } from 'react';

/** Wraps a retry so the button can show it is working and ignore a second press. */
export function useRetry(run: () => Promise<void>) {
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await run();
    } finally {
      setRetrying(false);
    }
  };
  return { retrying, retry };
}
