import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from './useDialogFocus';

interface BottomSheetProps {
  /** Heading shown in the sheet and naming the dialog. Without it, `label` names a sheet that draws its own head. */
  title?: string;
  label?: string;
  className?: string;
  text?: string;
  onClose: () => void;
  /** Show a close (X) button beside the title. */
  showClose?: boolean;
  children: ReactNode;
}

/** A sheet that slides up over the page: drag handle, title, one sentence, then the content. */
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
    <div className="modal-overlay modal-overlay--bottom" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`bottom-sheet ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        onClick={(e) => e.stopPropagation()}
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
