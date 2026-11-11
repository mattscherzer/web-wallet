import { useState, type FormEvent } from 'react';
import { ChevronDown, KeyRound, UserPlus, UserX } from 'lucide-react';
import { createStaff, resetStaffPin, setStaffDisabled, type StaffMember } from '../../db/admin';
import type { Wallet } from '../../db/wallets';
import { PIN_LENGTH, isPin } from '../../auth/pin';
import { useOwnerAction } from '../../auth/useOwnerAction';
import BottomSheet from '../../components/BottomSheet';
import { Field, InlineError, PinInput } from '../../components/FilledField';

const PIN_PROBLEM = `The PIN must be exactly ${PIN_LENGTH} digits`;
const PIN_HINT = `${PIN_LENGTH} digits. Hand it over in person.`;

interface SheetProps {
  onClose: () => void;
  onDone: () => Promise<void>;
}

export function AddStaffSheet({
  wallets,
  initialWalletId,
  onClose,
  onDone,
}: SheetProps & { wallets: Wallet[]; initialWalletId?: string }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [walletId, setWalletId] = useState(initialWalletId ?? wallets[0]?.id ?? '');
  const { error, setError, busy, go } = useOwnerAction(
    () => createStaff({ walletId, username: username.trim(), displayName: displayName.trim(), pin }),
    onDone,
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isPin(pin)) return setError(PIN_PROBLEM);
    void go();
  };
  return (
    <BottomSheet
      title="Add staff"
      text="Staff record and edit entries. They don’t need an account, only a username and a PIN."
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="bottom-sheet__form" aria-label="Add staff">
        <Field id="staff-display" label="Name shown in the history">
          <input
            id="staff-display"
            className="filled-field__input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <Field id="staff-username" label="Username">
          <input
            id="staff-username"
            className="filled-field__input"
            autoCapitalize="none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field id="staff-pin" label="PIN" hint={PIN_HINT}>
          <PinInput id="staff-pin" value={pin} onChange={setPin} />
        </Field>
        <Field id="staff-wallet" label="Wallet">
          <span className="filled-field__wrap">
            <select
              id="staff-wallet"
              className="filled-field__input"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <ChevronDown className="filled-field__chevron" size={20} aria-hidden="true" />
          </span>
        </Field>
        <InlineError message={error} />
        <button type="submit" className="btn btn--primary" disabled={busy || !walletId}>
          <UserPlus size={20} aria-hidden="true" />
          Add staff
        </button>
        <button type="button" className="link-btn" onClick={onClose}>
          Cancel
        </button>
      </form>
    </BottomSheet>
  );
}

export function ResetPinSheet({ member, onClose, onDone }: SheetProps & { member: StaffMember }) {
  const [pin, setPin] = useState('');
  const { error, setError, busy, go } = useOwnerAction(() => resetStaffPin(member.user_id, pin), onDone);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isPin(pin)) return setError(PIN_PROBLEM);
    void go();
  };
  return (
    <BottomSheet
      title={`New PIN for ${member.display_name}`}
      text={`${member.display_name}’s current PIN stops working. Hand over the new one in person.`}
      onClose={onClose}
    >
      <form
        onSubmit={submit}
        noValidate
        className="bottom-sheet__form"
        aria-label={`New PIN for ${member.display_name}`}
      >
        <Field id={`pin-${member.user_id}`} label="New PIN" hint={PIN_HINT}>
          <PinInput id={`pin-${member.user_id}`} value={pin} onChange={setPin} />
        </Field>
        <InlineError message={error} />
        <button type="submit" className="btn btn--primary" disabled={busy}>
          <KeyRound size={20} aria-hidden="true" />
          Save PIN
        </button>
        <button type="button" className="link-btn" onClick={onClose}>
          Cancel
        </button>
      </form>
    </BottomSheet>
  );
}

export function DisableSheet({ member, onClose, onDone }: SheetProps & { member: StaffMember }) {
  const { error, busy, go } = useOwnerAction(() => setStaffDisabled(member.user_id, true), onDone);
  const name = member.display_name;
  return (
    <BottomSheet
      title={`Disable ${name}?`}
      text={`${name} can no longer sign in, on any phone. Entries ${name} recorded stay in the books under ${name}’s name. You can enable ${name} again later.`}
      onClose={onClose}
    >
      <div className="bottom-sheet__form">
        <InlineError message={error} />
        <button type="button" className="btn btn--danger" disabled={busy} onClick={() => void go()}>
          <UserX size={20} aria-hidden="true" />
          {`Disable ${name}`}
        </button>
        <button type="button" className="btn btn--outline btn--tall" onClick={onClose}>
          {`Keep ${name}`}
        </button>
      </div>
    </BottomSheet>
  );
}
