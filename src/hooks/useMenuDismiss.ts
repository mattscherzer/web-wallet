import { useEffect, type RefObject } from 'react';

interface MenuRefs {
  trigger: RefObject<HTMLElement | null>;
  menu: RefObject<HTMLElement | null>;
  firstItem: RefObject<HTMLElement | null>;
}

export function useMenuDismiss(open: boolean, onClose: () => void, { trigger, menu, firstItem }: MenuRefs) {
  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        trigger.current?.focus();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target instanceof Node ? e.target : null;
      if (trigger.current?.contains(target) || menu.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, onClose, trigger, menu, firstItem]);
}
