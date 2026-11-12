import { createStaff, resetStaffPin, setStaffDisabled } from '../db/admin';
import { useWalletsAndStaff } from './useWalletsAndStaff';

export function useStaffAdmin() {
  return { ...useWalletsAndStaff(), createStaff, resetStaffPin, setStaffDisabled };
}

export type StaffAdmin = ReturnType<typeof useStaffAdmin>;
