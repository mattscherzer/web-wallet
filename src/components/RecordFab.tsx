import { useCallback, useRef, useState, type RefObject } from 'react';
import { useMenuDismiss } from '../hooks/useMenuDismiss';
import { Link, useLocation } from 'react-router';
import { Lock, Plus, X } from 'lucide-react';
import { indexStyle } from './indexStyle';
import { useUnlock } from '../auth/unlockContext';
import { RECORD_ACTIONS, nextMenuOpen, showFabAt, type MenuEvent } from './recordMenu';

interface RecordFabViewProps {
  open: boolean;
  onToggle: () => void;
  onScrim: () => void;
  onPick: () => void;
  fabRef?: RefObject<HTMLButtonElement | null>;
  firstItemRef?: RefObject<HTMLAnchorElement | null>;
  menuRef?: RefObject<HTMLDivElement | null>;
  locked?: boolean;
}

export function RecordFabView({
  open,
  onToggle,
  onScrim,
  onPick,
  fabRef,
  firstItemRef,
  menuRef,
  locked = false,
}: RecordFabViewProps) {
  if (locked) {
    return (
      <button
        type="button"
        ref={fabRef}
        className="record-fab record-fab--locked"
        id="record-fab"
        aria-label="Record. Locked: unlock to record"
        onClick={onToggle}
      >
        <Plus size={28} aria-hidden="true" />
        <span className="record-fab__lock" aria-hidden="true">
          <Lock size={16} />
        </span>
      </button>
    );
  }
  return (
    <>
      {open && <button type="button" className="record-scrim" tabIndex={-1} aria-hidden="true" onClick={onScrim} />}
      {open && (
        <div ref={menuRef} className="record-menu" role="menu" aria-label="Record" id="record-menu">
          {RECORD_ACTIONS.map(({ to, label, icon: Icon }, i) => (
            <Link
              key={to}
              to={to}
              role="menuitem"
              className="record-menu__item"
              style={indexStyle(i)}
              ref={i === 0 ? firstItemRef : undefined}
              onClick={onPick}
            >
              <Icon size={24} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      )}
      <button
        type="button"
        ref={fabRef}
        className={`record-fab${open ? ' record-fab--open' : ''}`}
        id="record-fab"
        aria-label={open ? 'Close record menu' : 'Record'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'record-menu' : undefined}
        onClick={onToggle}
      >
        {open ? <X size={24} aria-hidden="true" /> : <Plus size={28} aria-hidden="true" />}
      </button>
    </>
  );
}

export function RecordFab() {
  const { pathname } = useLocation();
  const { locked, openUnlock } = useUnlock();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpenFor(null);
  }
  const fabRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const send = (event: MenuEvent) => {
    setOpenFor(nextMenuOpen(open, event) ? pathname : null);
    if (event === 'escape' || event === 'scrim' || (event === 'toggle' && open)) fabRef.current?.focus();
  };

  const close = useCallback(() => setOpenFor(null), []);
  useMenuDismiss(open, close, { trigger: fabRef, menu: menuRef, firstItem: firstItemRef });

  if (!showFabAt(pathname)) return null;

  return (
    <RecordFabView
      open={open}
      locked={locked}
      onToggle={locked ? openUnlock : () => send('toggle')}
      onScrim={() => send('scrim')}
      onPick={() => send('itemPick')}
      fabRef={fabRef}
      firstItemRef={firstItemRef}
      menuRef={menuRef}
    />
  );
}
