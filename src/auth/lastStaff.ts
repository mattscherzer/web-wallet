/** The staff username used last on this device: sign-in prefills it and unlock re-checks that person's PIN. */
export const LAST_STAFF_KEY = 'treasury.lastStaffUsername';

export function readLastStaff(): string {
  try {
    return window.localStorage.getItem(LAST_STAFF_KEY) ?? '';
  } catch {
    return '';
  }
}

export function forgetStaff() {
  try {
    window.localStorage.removeItem(LAST_STAFF_KEY);
  } catch {
    // Storage blocked: nothing was remembered anyway.
  }
}

export function rememberStaff(username: string) {
  try {
    window.localStorage.setItem(LAST_STAFF_KEY, username);
  } catch {
    // Storage blocked: the username just isn't remembered.
  }
}
