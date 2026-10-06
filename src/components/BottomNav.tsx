import { NavLink } from 'react-router-dom';
import { House, List, FileText, Ellipsis } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: House, label: 'Overview' },
  { to: '/history', icon: List, label: 'History' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/more', icon: Ellipsis, label: 'More' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" id="bottom-nav" aria-label="Main">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`
          }
          end={to === '/'}
        >
          <span className="bottom-nav__icon-wrap">
            <Icon size={24} />
          </span>
          <span className="bottom-nav__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
