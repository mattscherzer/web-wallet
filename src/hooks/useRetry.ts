import { useState } from 'react';

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
