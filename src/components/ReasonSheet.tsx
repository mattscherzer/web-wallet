import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface ReasonSheetProps {
  title: string;
  reasons: readonly string[];
  reasonLabel: string;
  confirmLabel: string;
  /** Extra fields shown above the reasons, e.g. the new amount. */
  children?: ReactNode;
  /** Return a message to stop before the reason is checked. */
  validate?: () => string | null;
  onConfirm: (reason: string, note: string) => void;
  onCancel: () => void;
  withNote?: boolean;
  /** A problem from the last attempt, e.g. that saving failed. */
  error?: string | null;
}

/** A bottom sheet that asks for a reason (and optionally a note) before a change is made. */
export default function ReasonSheet({
  title,
  reasons,
  reasonLabel,
  confirmLabel,
  children,
  validate,
  onConfirm,
  onCancel,
  withNote,
  error,
}: ReasonSheetProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  // Keyboard: focus moves into the dialog, Tab stays inside, Escape closes, and focus goes back to the opener.
  // Keys typed elsewhere (e.g. in the PIN box shown on top) are left alone.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!dialog || !dialog.contains(e.target as Node)) return;
      if (e.key === 'Escape') {
        onCancelRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>('button, input, textarea, [href], [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !(el as HTMLInputElement).disabled);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const submit = () => {
    const message = validate?.() ?? (reason ? null : 'Choose a reason');
    if (message) {
      setProblem(message);
      return;
    }
    setProblem(null);
    onConfirm(reason, note);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="modal-content sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="sheet__title">{title}</h2>
        {children}
        <div role="radiogroup" aria-label={reasonLabel} className="sheet__reasons">
          {reasons.map((r) => (
            <label key={r} className={`choice${reason === r ? ' choice--on' : ''}`}>
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
              <span>{r}</span>
            </label>
          ))}
        </div>
        {withNote && (
          <div className="form-section">
            <label className="form-label" htmlFor="reason-note">Note (optional)</label>
            <textarea id="reason-note" className="form-textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        )}
        {(problem || error) && <p className="field-error" role="status">{problem ?? error}</p>}
        <button type="button" className="btn btn--primary" onClick={submit}>{confirmLabel}</button>
        <button type="button" className="pin-modal__cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
