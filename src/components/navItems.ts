import { House, List, FileText, Ellipsis } from 'lucide-react';

export const HISTORY_PATH = '/history';

export const NAV_ITEMS = [
  { to: '/', icon: House, label: 'Overview' },
  { to: HISTORY_PATH, icon: List, label: 'History' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/more', icon: Ellipsis, label: 'More' },
];
