import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface BottomSheetProps {
  title?: string;
  label?: string;
  className?: string;
  text?: string;
  onClose: () => void;
  showClose?: boolean;
  children: ReactNode;
}

export default function BottomSheet({
  title,
  label,
  className = '',
  text,
  onClose,
  showClose,
  children,
}: BottomSheetProps) {
  const titleId = useId();
  const dialogRef = useDialogFocus(onClose);
  return (
    <div className="modal-overlay modal-overlay--bottom">
      <button type="button" className="modal-scrim" tabIndex={-1} aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`bottom-sheet ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
      >
        <span className="bottom-sheet__handle" aria-hidden="true" />
        {title && (
          <div className="dialog-head">
            <div className="bottom-sheet__title-row">
              <h2 id={titleId} className="title-lg">
                {title}
              </h2>
              {showClose && (
                <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
                  <X size={24} aria-hidden="true" />
                </button>
              )}
            </div>
            {text && <p className="lead-text">{text}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
