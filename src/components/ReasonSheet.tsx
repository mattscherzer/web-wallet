import { useState, type ReactNode } from 'react';
import BottomSheet from './BottomSheet';
import FormError from './FormError';

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
  error?: string | null;
}

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
    <BottomSheet title={title} onClose={onCancel}>
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
          <label className="form-label" htmlFor="reason-note">
            Note (optional)
          </label>
          <textarea
            id="reason-note"
            className="form-textarea"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
      {(problem || error) && <FormError>{problem ?? error}</FormError>}
      <button type="button" className="btn btn--primary" onClick={submit}>
        {confirmLabel}
      </button>
      <button type="button" className="link-btn" onClick={onCancel}>
        Cancel
      </button>
    </BottomSheet>
  );
}
