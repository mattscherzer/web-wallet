/** Keeps Tab inside `items`. `escaped` means focus is outside them, so Tab re-enters at the first or last. */
export function trapTab(e: KeyboardEvent, items: HTMLElement[], escaped: boolean, container?: HTMLElement) {
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const at = document.activeElement;
  if (escaped) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && (at === first || at === container)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && at === last) {
    e.preventDefault();
    first.focus();
  }
}
