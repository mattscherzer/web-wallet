import { useId, useState, type ReactNode } from 'react';

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
    <div className="modal-overlay" onClick={onCancel} onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <div
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
