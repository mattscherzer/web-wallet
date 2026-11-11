import { useEffect, useRef, useState } from 'react';

/** Open dialogs, newest last: only the newest answers keys typed while focus is on the page body. */
const open: HTMLElement[] = [];

/**
 * Keyboard behaviour for a modal dialog: focus moves into it, Tab stays inside, Escape closes it, and focus goes
 * back to the opener. Keys typed elsewhere (e.g. in a password box shown on top) are left alone.
 */
export function useDialogFocus<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const dialogRef = useRef<T>(null);
  // Read while rendering: an autofocused field inside the dialog takes focus before effects run.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    // An autofocused field inside the dialog keeps focus.
    if (!dialog?.contains(document.activeElement)) dialog?.focus();
    if (dialog) open.push(dialog);
    const onKey = (e: KeyboardEvent) => {
      // Focus falls to the body when the focused control disappears (e.g. a Retry button that hides itself).
      const focusLost = e.target === document.body && open[open.length - 1] === dialog;
      if (!dialog || !(focusLost || dialog.contains(e.target as Node))) return;
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !(el as HTMLInputElement).disabled);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (focusLost) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const at = dialog ? open.indexOf(dialog) : -1;
      if (at >= 0) open.splice(at, 1);
      // StrictMode's dev-only fake unmount leaves the dialog in the page; only a real close restores focus.
      if (!dialog?.isConnected) opener?.focus();
    };
  }, [opener]);

  return dialogRef;
}
