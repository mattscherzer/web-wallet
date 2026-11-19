import { useEffect, useRef, useState } from 'react';
import { trapTab } from './trapTab';

const open: HTMLElement[] = [];
const openers = new WeakMap<HTMLElement, HTMLElement | null>();

// A dialog swapped for another (Export -> Period) leaves the next opener in the old tree; follow the chain to a live one.
function liveOpener(start: HTMLElement | null) {
  let target = start;
  while (target && !target.isConnected) {
    let owner: HTMLElement | null = target.parentElement;
    while (owner && !openers.has(owner)) owner = owner.parentElement;
    target = owner ? (openers.get(owner) ?? null) : null;
  }
  return target;
}

export function useDialogFocus<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const dialogRef = useRef<T>(null);
  // An autofocused field inside the dialog takes focus before effects run, so the opener is read during render.
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog?.contains(document.activeElement)) dialog?.focus();
    if (dialog) {
      open.push(dialog);
      openers.set(dialog, opener);
    }
    const onKey = (e: KeyboardEvent) => {
      const focusLost = e.target === document.body && open[open.length - 1] === dialog;
      if (!dialog || !(focusLost || dialog.contains(e.target instanceof Node ? e.target : null))) return;
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.matches(':disabled'));
      trapTab(e, items, focusLost, dialog);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const at = dialog ? open.indexOf(dialog) : -1;
      if (at >= 0) open.splice(at, 1);
      // StrictMode's dev-only fake unmount leaves the dialog in the page; only a real close restores focus.
      if (!dialog?.isConnected) liveOpener(opener)?.focus();
    };
  }, [opener]);

  return dialogRef;
}
