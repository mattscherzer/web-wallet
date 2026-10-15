interface SnackbarProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
}

/** A short notice above the bottom bar with one action. */
export default function Snackbar({ message, actionLabel, onAction }: SnackbarProps) {
  return (
    <div className="snackbar" role="status">
      <span className="snackbar__message">{message}</span>
      <button type="button" className="snackbar__action" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}
