/** What a page shows instead of its content when its first read failed. */
export default function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="empty-state">
      <p role="alert" className="empty-state__text">
        Couldn't load {what}. Check your connection and try again.
      </p>
      <button type="button" className="btn btn--outline" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
