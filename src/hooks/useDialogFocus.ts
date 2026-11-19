import { useEffect, useRef, useState } from 'react';

const open: HTMLElement[] = [];

function trapTab(e: KeyboardEvent, dialog: HTMLElement, focusLost: boolean) {
  const items = Array.from(
    dialog.querySelectorAll<HTMLElement>('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])'),
  ).filter((el) => !el.matches(':disabled'));
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
}

export function useDialogFocus<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const dialogRef = useRef<T>(null);
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog?.contains(document.activeElement)) dialog?.focus();
    if (dialog) open.push(dialog);
    const onKey = (e: KeyboardEvent) => {
      const focusLost = e.target === document.body && open[open.length - 1] === dialog;
      if (!dialog || !(focusLost || dialog.contains(e.target instanceof Node ? e.target : null))) return;
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      trapTab(e, dialog, focusLost);
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
