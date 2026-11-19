import { useEffect, type RefObject } from 'react';

export function useFocusOnRound(ref: RefObject<HTMLElement | null>, round: number) {
  useEffect(() => {
    if (round > 0) ref.current?.focus();
  }, [ref, round]);
}
