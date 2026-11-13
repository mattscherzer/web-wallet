import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { X } from 'lucide-react';

const SNACKBAR_MS = 10_000;
const SWIPE_DISMISS_PX = 80;

interface SnackbarProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
}

export default function Snackbar({ message, actionLabel, onAction }: SnackbarProps) {
  const [visible, setVisible] = useState(true);
  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), SNACKBAR_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const start = (e: PointerEvent<HTMLDivElement>) => {
    // Capturing on a button would swallow its click.
    if ((e.target as HTMLElement).closest('button')) return;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (startX.current !== null) setDrag(e.clientX - startX.current);
  };
  const end = () => {
    if (startX.current === null) return;
    startX.current = null;
    if (Math.abs(drag) >= SWIPE_DISMISS_PX) setVisible(false);
    else setDrag(0);
  };

  return (
    <div
      className="snackbar"
      role="status"
      style={{ '--snackbar-ms': `${SNACKBAR_MS}ms`, '--snackbar-drag': `${drag}px` } as CSSProperties}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span className="snackbar__message">{message}</span>
      <button type="button" className="snackbar__action" onClick={onAction}>
        {actionLabel}
      </button>
      <button type="button" className="snackbar__dismiss" aria-label="Dismiss" onClick={() => setVisible(false)}>
        <X size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
