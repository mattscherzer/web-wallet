/* eslint-disable react-refresh/only-export-components -- the pure menu logic is exported next to the components it drives */
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Plus, X } from 'lucide-react';

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

interface RecordFabViewProps {
  open: boolean;
  onToggle: () => void;
  onScrim: () => void;
  onPick: () => void;
  fabRef?: RefObject<HTMLButtonElement | null>;
  firstItemRef?: RefObject<HTMLAnchorElement | null>;
}

export function RecordFabView({
  open,
  onToggle,
  onScrim,
  onPick,
  fabRef,
  firstItemRef,
}: RecordFabViewProps) {
  return (
    <>
      {open && <div className="record-scrim" aria-hidden="true" onClick={onScrim} />}
      {open && (
        <div className="record-menu" role="menu" aria-label="Record" id="record-menu">
          {RECORD_ACTIONS.map(({ to, label, icon: Icon }, i) => (
            <Link
              key={to}
              to={to}
              role="menuitem"
              className="record-menu__item"
              style={{ '--i': i } as CSSProperties}
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
  // The menu is open for the page it was opened on, so navigating closes it.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const fabRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  const send = (event: MenuEvent) => {
    setOpenFor(nextMenuOpen(open, event) ? pathname : null);
    if (event === 'escape' || event === 'scrim') fabRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (menuEventForKey(e.key) === 'escape') {
        setOpenFor(null);
        fabRef.current?.focus();
      }
    };
    // Tabbing out of the open menu closes it instead of leaving it open behind the scrim.
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Node;
      if (fabRef.current?.contains(target) || document.getElementById('record-menu')?.contains(target)) return;
      setOpenFor(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  if (!showFabAt(pathname)) return null;

  return (
    <RecordFabView
      open={open}
      onToggle={() => send('toggle')}
      onScrim={() => send('scrim')}
      onPick={() => send('itemPick')}
      fabRef={fabRef}
      firstItemRef={firstItemRef}
    />
  );
}
