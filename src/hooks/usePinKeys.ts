import { useEffect } from 'react';

const isTypingInField = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

export function usePinKeys(onDigit: (digit: string) => void, onBackspace: () => void, disabled: boolean) {
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || isTypingInField(e.target)) return;
      // A held digit would otherwise fill the PIN and submit a wrong attempt.
      if (/^\d$/.test(e.key) && !e.repeat) onDigit(e.key);
      else if (e.key === 'Backspace') onBackspace();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDigit, onBackspace, disabled]);
}
