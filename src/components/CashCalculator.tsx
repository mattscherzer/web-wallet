import { useEffect, useReducer, useRef, useState } from 'react';
import { CashCountView } from './CashCountView';
import { applyAndClose, countReducer, initialCountState } from '../utils/cashCount';

interface CashCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (total: number) => void;
}

/** Counting state lives only while the overlay is open, so closing or applying starts fresh. */
function CountOverlay({ onClose, onApply }: Omit<CashCalculatorProps, 'isOpen'>) {
  const [state, dispatch] = useReducer(countReducer, undefined, initialCountState);
  const closeRef = useRef(onClose);
  // Read during the first render, before Back takes focus, so it can be restored on close.
  const [opener] = useState(() =>
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null),
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
        // Escape in a count field commits and leaves it; a second Escape closes the screen.
        if (field instanceof HTMLInputElement) field.blur();
        else closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      // Keep Tab inside the modal dialog.
      const focusable = Array.from(
        document.querySelectorAll<HTMLElement>('.count-screen button:not(:disabled), .count-screen input'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active !== null && focusable.includes(active);
      if (!inside) {
        // Focus is on the page behind (or the body): bring it back into the dialog.
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

  return (
    <CashCountView
      state={state}
      dispatch={dispatch}
      onClose={onClose}
      onApply={(total) => applyAndClose(total, onApply, onClose)}
    />
  );
}

export default function CashCalculator({ isOpen, onClose, onApply }: CashCalculatorProps) {
  return isOpen ? <CountOverlay onClose={onClose} onApply={onApply} /> : null;
}
