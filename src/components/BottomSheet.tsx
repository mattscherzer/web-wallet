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
