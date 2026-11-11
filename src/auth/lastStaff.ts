import { safeStorage } from '../platform/storage';

/** The staff username used last on this device: sign-in prefills it and unlock re-checks that person's PIN. */
export const LAST_STAFF_KEY = 'treasury.lastStaffUsername';

export const readLastStaff = (): string => safeStorage.getItem(LAST_STAFF_KEY) ?? '';

export const forgetStaff = () => safeStorage.removeItem(LAST_STAFF_KEY);

export const rememberStaff = (username: string) => safeStorage.setItem(LAST_STAFF_KEY, username);
