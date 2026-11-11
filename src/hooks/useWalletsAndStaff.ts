import { useCallback, useEffect, useState } from 'react';
import { listStaff } from '../db/admin';
import { type StaffMember } from '../domain/staff';
import { fetchWallets } from '../db/wallets';
import { type Wallet } from '../domain/wallet';

/** Every wallet the owner can see and the staff of all of them. `loaded` flips once the first attempt has finished. */
export function useWalletsAndStaff() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const w = await fetchWallets();
      let partial = false;
      const lists = await Promise.all(
        w.map((wallet) =>
          listStaff(wallet.id).catch(() => {
            partial = true;
            return [] as StaffMember[];
          }),
        ),
      );
      setWallets(w);
      setStaff([...new Map(lists.flat().map((s) => [s.user_id, s])).values()]);
      setLoadError(partial);
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

  return { wallets, staff, loadError, loaded, reload };
}
