import { useEffect, useState } from 'react';
import { fetchAuthorNames } from './admin';

/** Who is who, for "created by". Empty until loaded or if it can't be loaded: authors then show as unknown. */
export function useAuthorNames(): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    fetchAuthorNames().then(
      (n) => live && setNames(n),
      (err) => console.error('Failed to load author names:', err),
    );
    return () => {
      live = false;
    };
  }, []);
  return names;
}
