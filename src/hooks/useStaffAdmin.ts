import { createStaff, resetStaffPin, setStaffDisabled } from '../db/admin';
import { useWalletsAndStaff } from './useWalletsAndStaff';

/** Wallets and staff for the admin screens, plus the staff commands. */
export function useStaffAdmin() {
  return { ...useWalletsAndStaff(), createStaff, resetStaffPin, setStaffDisabled };
}

export type StaffAdmin = ReturnType<typeof useStaffAdmin>;
