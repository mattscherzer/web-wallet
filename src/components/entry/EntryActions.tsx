import { Pencil, RotateCcw, Trash2 } from 'lucide-react';

interface EntryActionsProps {
  removed: boolean;
  canRestore: boolean;
  canRemove: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onRestore: () => void;
}

export default function EntryActions({
  removed,
  canRestore,
  canRemove,
  onEdit,
  onRemove,
  onRestore,
}: EntryActionsProps) {
  return (
    <div className="entry__toolbar" role="group" aria-label="Entry actions">
      {removed ? (
        canRestore && (
          <button type="button" className="btn btn--primary" onClick={onRestore}>
            <RotateCcw size={18} aria-hidden="true" /> Restore
          </button>
        )
      ) : (
        <>
          <button type="button" className="btn btn--outline" onClick={onEdit}>
            <Pencil size={18} aria-hidden="true" /> Edit
          </button>
          {canRemove && (
            <button type="button" className="btn btn--outline entry__remove" onClick={onRemove}>
              <Trash2 size={18} aria-hidden="true" /> Remove
            </button>
          )}
        </>
      )}
    </div>
  );
}
