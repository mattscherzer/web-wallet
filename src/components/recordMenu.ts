import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from 'lucide-react';

export const RECORD_ACTIONS = [
  { to: '/record?type=in', label: 'Money in', icon: ArrowDownToLine },
  { to: '/record?type=out', label: 'Money out', icon: ArrowUpFromLine },
  { to: '/record?type=transfer', label: 'Transfer', icon: ArrowLeftRight },
];

/** The three old form addresses and where they go now. */
const LEGACY_REDIRECTS: Record<string, string> = {
  '/add': '/record?type=in',
  '/withdraw': '/record?type=out',
  '/transfer': '/record?type=transfer',
};

export function legacyRedirect(pathname: string): string | null {
  return LEGACY_REDIRECTS[pathname] ?? null;
}

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
