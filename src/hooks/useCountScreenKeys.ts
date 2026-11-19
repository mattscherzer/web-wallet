import { useEffect, useRef, useState } from 'react';
import { trapTab } from './trapTab';

export function useCountScreenKeys<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const screenRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  // The overlay is also rendered on the server in tests, where there is no document.
  const [opener] = useState(() =>
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const screen = screenRef.current;
    screen?.querySelector<HTMLElement>('.count-icon-btn')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.isComposing) return;
        const field = document.activeElement;
        if (field instanceof HTMLInputElement) field.blur();
        else closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      if (!screen) return;
      const focusable = Array.from(screen.querySelectorAll<HTMLElement>('button:not(:disabled), input'));
      const { activeElement } = document;
      trapTab(e, focusable, !(activeElement instanceof HTMLElement && focusable.includes(activeElement)));
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [opener]);

  return screenRef;
}
