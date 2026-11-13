import { useCallback, useEffect, useState } from 'react';
import { listStaff } from '../db/admin';
import { type StaffMember } from '../domain/staff';
import { fetchWallets } from '../db/wallets';
import { type Wallet } from '../domain/wallet';

/** Every wallet the owner can see and the staff of all of them. `loaded` flips once the first attempt has finished. */
export function useWalletsAndStaff() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffUnknown, setStaffUnknown] = useState<ReadonlySet<string>>(new Set());
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const w = await fetchWallets();
      const results = await Promise.all(
        w.map((wallet) =>
          listStaff(wallet.id).then(
            (list) => ({ id: wallet.id, list }),
            () => ({ id: wallet.id, list: null }),
          ),
        ),
      );
      const unknown = new Set(results.filter((r) => !r.list).map((r) => r.id));
      setWallets(w);
      setStaff([...new Map(results.flatMap((r) => r.list ?? []).map((s) => [s.user_id, s])).values()]);
      setStaffUnknown(unknown);
      setLoadError(unknown.size > 0);
    } catch (err) {
      console.error('Failed to load wallets and staff:', err);
      setLoadError(true);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    void reload();
  }, [reload]);

  return { wallets, staff, staffUnknown, loadError, loaded, reload };
}
