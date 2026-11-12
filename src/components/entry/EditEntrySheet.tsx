import { useState } from 'react';
import { EDIT_REASONS, validateEntryEdit, type Transaction } from '../../domain/transaction';
import { parseAmount } from '../../domain/recordForm';
import ReasonSheet from '../ReasonSheet';

interface EditEntrySheetProps {
  tx: Transaction;
  error: string | null;
  onCancel: () => void;
  onSave: (updates: { amount: number; notes: string }, reason: string) => void;
}

export default function EditEntrySheet({ tx, error, onCancel, onSave }: EditEntrySheetProps) {
  const [amount, setAmount] = useState(String(Number(tx.amount)));
  const [notes, setNotes] = useState(tx.notes);
  return (
    <ReasonSheet
      title="Edit entry"
      reasons={EDIT_REASONS}
      reasonLabel="Reason for change"
      confirmLabel="Save changes"
      error={error}
      onCancel={onCancel}
      validate={() => validateEntryEdit(tx, amount, notes)}
      onConfirm={(reason) => onSave({ amount: parseAmount(amount), notes: notes.trim() }, reason)}
    >
      <div className="form-section">
        <label className="form-label" htmlFor="edit-amount">
          Amount
        </label>
        <input
          id="edit-amount"
          type="text"
          inputMode="decimal"
          className="form-input num"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="form-section">
        <label className="form-label" htmlFor="edit-notes">
          Notes
        </label>
        <textarea
          id="edit-notes"
          className="form-textarea"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </ReasonSheet>
  );
}
