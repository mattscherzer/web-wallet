import { type StaffMember } from '../../domain/staff';
import { useOwnerAction } from '../../auth/useOwnerAction';
import { InlineError } from '../../components/FilledField';
import { walletInitials } from '../../domain/wallet';
import type { StaffAdmin } from '../../hooks/useStaffAdmin';

interface StaffRowProps {
  member: StaffMember;
  setStaffDisabled: StaffAdmin['setStaffDisabled'];
  onResetPin: () => void;
  onDisable: () => void;
  onDone: () => Promise<void>;
}

export default function StaffRow({ member, setStaffDisabled, onResetPin, onDisable, onDone }: StaffRowProps) {
  const enable = useOwnerAction(() => setStaffDisabled(member.user_id, false), onDone);
  return (
    <li>
      <div className="list-row">
        <span className={`wallet-avatar${member.disabled ? '' : ' wallet-avatar--tonal'}`} aria-hidden="true">
          {walletInitials(member.display_name).slice(0, 1)}
        </span>
        <span className="list-row__text">
          <span className={`list-row__name${member.disabled ? ' list-row__name--muted' : ''}`}>
            {member.display_name}
            {member.disabled && ' · disabled'}
          </span>
          <span className="list-row__sub list-row__sub--mono">{member.username}</span>
        </span>
      </div>
      <div className="admin-actions">
        <button
          type="button"
          className="btn btn--outline admin-action"
          aria-label={`Reset PIN for ${member.display_name}`}
          onClick={onResetPin}
        >
          Reset PIN
        </button>
        {member.disabled ? (
          <button
            type="button"
            className="btn btn--outline admin-action"
            aria-label={`Enable ${member.display_name}`}
            disabled={enable.busy}
            onClick={() => void enable.go()}
          >
            Enable
          </button>
        ) : (
          <button
            type="button"
            className="btn admin-action admin-action--danger"
            aria-label={`Disable ${member.display_name}`}
            onClick={onDisable}
          >
            Disable
          </button>
        )}
      </div>
      <InlineError message={enable.error} />
    </li>
  );
}
