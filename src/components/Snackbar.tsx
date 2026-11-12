interface SnackbarProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
}

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
