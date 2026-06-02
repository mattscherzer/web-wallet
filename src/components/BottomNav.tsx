import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, MinusCircle, Clock } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/add', icon: PlusCircle, label: 'Add' },
  { to: '/withdraw', icon: MinusCircle, label: 'Withdraw' },
  { to: '/history', icon: Clock, label: 'History' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" id="bottom-nav">
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
            <Icon size={22} />
          </span>
          <span className="bottom-nav__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
