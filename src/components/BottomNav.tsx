import { NavLink } from 'react-router';
import { NAV_ITEMS } from './navItems';

export default function BottomNav() {
  return (
    <nav className="bottom-nav" id="bottom-nav" aria-label="Main">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
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
