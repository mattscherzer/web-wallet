import { useEffect, useRef, type ReactNode } from 'react';

interface BottomSheetProps {
  /** The dialog's accessible name. */
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

/** A sheet that slides up from the bottom: backdrop tap and Escape close it, focus moves into it. */
export default function BottomSheet({ label, onClose, className = '', children }: BottomSheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key !== 'Tab' || !ref.current) return;
      // aria-modal: Tab wraps inside the sheet instead of reaching the page behind it.
      const items = [...ref.current.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea')].filter(
        (el) => !(el as HTMLButtonElement).disabled,
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === ref.current)) {
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
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="bottom-sheet__scrim" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`bottom-sheet ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="bottom-sheet__grabber" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
