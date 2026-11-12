/** localStorage that never throws (private mode, blocked site data): reads find nothing, writes are dropped. */
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Dropped: nothing is remembered.
    }
  },
  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Dropped: nothing was remembered anyway.
    }
  },
};
