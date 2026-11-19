import { useEffect, useRef, useState } from 'react';

export function useCountScreenKeys(onClose: () => void) {
  const closeRef = useRef(onClose);
  const [opener] = useState(() =>
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    document.querySelector<HTMLElement>('.count-screen .count-icon-btn')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.isComposing) return;
        const field = document.activeElement;
        if (field instanceof HTMLInputElement) field.blur();
        else closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        document.querySelectorAll<HTMLElement>('.count-screen button:not(:disabled), .count-screen input'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const inside = active !== null && focusable.includes(active);
      if (!inside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [opener]);
}
