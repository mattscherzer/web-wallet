import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from 'lucide-react';

export const RECORD_ACTIONS = [
  { to: '/add', label: 'Money in', icon: ArrowDownToLine },
  { to: '/withdraw', label: 'Money out', icon: ArrowUpFromLine },
  { to: '/transfer', label: 'Transfer', icon: ArrowLeftRight },
];

const FAB_PATHS = ['/', '/history'];

/** The Record button is shown on Overview and History only. */
export function showFabAt(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return FAB_PATHS.includes(path);
}

export type MenuEvent = 'toggle' | 'escape' | 'scrim' | 'itemPick' | 'routeChange';

export function nextMenuOpen(open: boolean, event: MenuEvent): boolean {
  return event === 'toggle' ? !open : false;
}

export function menuEventForKey(key: string): MenuEvent | null {
  return key === 'Escape' ? 'escape' : null;
}
