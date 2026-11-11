import { useState } from 'react';
import { Link } from 'react-router';
import { Plus, UserPlus } from 'lucide-react';
import type { StaffMember } from '../domain/staff';
import { useStaffAdmin } from '../hooks/useStaffAdmin';
import { useAuth } from '../auth/useAuth';
import { useOptionalWallet } from '../wallet/useWallet';
import { walletInitials } from '../domain/wallet';
import AdminHeader from './admin/AdminHeader';
import AdminSkeleton from './admin/AdminSkeleton';
import OwnersOnly from './admin/OwnersOnly';
import StaffRow from './admin/StaffRow';
import { AddStaffSheet, DisableSheet, ResetPinSheet } from './admin/StaffSheets';

/**
 * Wallets and staff, for owners. The page check below is a convenience only: what protects the data are the
 * database policies and the owner check inside the staff-admin function.
 */
export default function AdminPage() {
  const { status, profile } = useAuth();
  if (status === 'loading') return <AdminSkeleton />;
  if (profile?.kind !== 'owner') return <OwnersOnly />;
  return <Dashboard />;
}

type Sheet = { kind: 'add' } | { kind: 'pin'; member: StaffMember } | { kind: 'disable'; member: StaffMember };

function Dashboard() {
  const wallet = useOptionalWallet();
  const { wallets, staff, loadError, loaded, reload, createStaff, resetStaffPin, setStaffDisabled } = useStaffAdmin();
  const [sheet, setSheet] = useState<Sheet | null>(null);

  if (!loaded) return <AdminSkeleton />;

  const shown = wallets.find((w) => w.id === wallet?.current?.id) ?? wallets[0];
  const members = shown ? staff.filter((s) => s.wallet_id === shown.id) : [];
  const close = () => setSheet(null);
  const done = async () => {
    await reload();
    close();
  };

  return (
    <div className="admin">
      <AdminHeader />
      <p className="admin__intro">
        Only owners see this page. Staff record and edit entries, and each belongs to one wallet.
      </p>
      {loadError && (
        <p role="alert" className="form-error">
          Couldn’t load everything. Check your connection and try again.
        </p>
      )}
      <section aria-label="Wallets">
        <h2 className="section-title">Wallets</h2>
        <ul className="card-list">
          {wallets.map((w) => {
            const count = staff.filter((s) => s.wallet_id === w.id).length;
            return (
              <li key={w.id}>
                <div className="list-row">
                  <span
                    className={`wallet-avatar wallet-avatar--${w.id === shown?.id ? 'current' : 'tonal'}`}
                    aria-hidden="true"
                  >
                    {walletInitials(w.name)}
                  </span>
                  <span className="list-row__text">
                    <span className="list-row__name">{w.name}</span>
                    <span className="list-row__sub">{count === 0 ? 'No staff yet' : `${count} staff`}</span>
                  </span>
                </div>
              </li>
            );
          })}
          <li>
            <Link to="/wallets/new" className="list-row list-row--action">
              <Plus size={20} aria-hidden="true" />
              New wallet
            </Link>
          </li>
        </ul>
      </section>
      {shown && members.length > 0 && (
        <section aria-label={`Staff of ${shown.name}`}>
          <h2 className="section-title">{`Staff · ${shown.name}`}</h2>
          <ul className="card-list">
            {members.map((s) => (
              <StaffRow
                key={s.user_id}
                member={s}
                setStaffDisabled={setStaffDisabled}
                onResetPin={() => setSheet({ kind: 'pin', member: s })}
                onDisable={() => setSheet({ kind: 'disable', member: s })}
                onDone={reload}
              />
            ))}
          </ul>
        </section>
      )}
      <button
        type="button"
        className="btn btn--primary admin__fab"
        disabled={wallets.length === 0}
        onClick={() => setSheet({ kind: 'add' })}
      >
        <UserPlus size={20} aria-hidden="true" />
        Add staff
      </button>
      {sheet?.kind === 'add' && (
        <AddStaffSheet
          wallets={wallets}
          createStaff={createStaff}
          initialWalletId={shown?.id}
          onClose={close}
          onDone={done}
        />
      )}
      {sheet?.kind === 'pin' && (
        <ResetPinSheet member={sheet.member} resetStaffPin={resetStaffPin} onClose={close} onDone={done} />
      )}
      {sheet?.kind === 'disable' && (
        <DisableSheet member={sheet.member} setStaffDisabled={setStaffDisabled} onClose={close} onDone={done} />
      )}
    </div>
  );
}
