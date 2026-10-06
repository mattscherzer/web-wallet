import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

// Loaded dynamically so a missing module fails the assertion instead of crashing the file.
const mod = await import('./RecordFab').catch(() => undefined);
const menu = await import('./recordMenu').catch(() => undefined);

function lib() {
  expect(mod, 'src/components/RecordFab.tsx must exist').toBeDefined();
  return mod!;
}

function menuLib() {
  expect(menu, 'src/components/recordMenu.ts must exist').toBeDefined();
  return menu!;
}

function view(open: boolean) {
  const { RecordFabView } = lib();
  return renderToStaticMarkup(
    <MemoryRouter>
      <RecordFabView open={open} onToggle={() => {}} onScrim={() => {}} onPick={() => {}} />
    </MemoryRouter>,
  );
}

describe('RecordFab visibility', () => {
  it('shows on Overview and History only', () => {
    const { RecordFab } = lib();
    const { showFabAt } = menuLib();
    for (const p of ['/', '/history', '/history/']) expect(showFabAt(p), p).toBe(true);
    for (const p of ['/add', '/withdraw', '/transfer', '/reports', '/more', '/history/x'])
      expect(showFabAt(p), p).toBe(false);

    const at = (path: string) =>
      renderToStaticMarkup(
        <MemoryRouter initialEntries={[path]}>
          <RecordFab />
        </MemoryRouter>,
      );
    expect(at('/')).toMatch(/aria-label="Record"/);
    expect(at('/history')).toMatch(/aria-label="Record"/);
    expect(at('/add')).toBe('');
    expect(at('/reports')).toBe('');
  });
});

describe('RecordFabView', () => {
  it('closed: a Record button that opens a menu, and no menu or scrim', () => {
    const html = view(false);
    expect(html).toMatch(/<button[^>]*aria-label="Record"/);
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="menu"');
    expect(html).not.toContain('record-scrim');
  });

  it('open: menu with Money in, Money out and Transfer, a close button and a scrim', () => {
    const html = view(true);
    expect(html).toMatch(/role="menu"[^>]*aria-label="Record"|aria-label="Record"[^>]*role="menu"/);
    const positions = ['Money in', 'Money out', 'Transfer'].map((l) => html.indexOf(`>${l}<`));
    expect(positions.every((p) => p > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html.match(/role="menuitem"/g)?.length).toBe(3);
    expect(html).toMatch(/<button[^>]*aria-label="Close record menu"/);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('record-scrim');
  });

  it('menu items link to the add, withdraw and transfer forms', () => {
    const html = view(true);
    const href = (label: string) =>
      html.match(new RegExp(`<a [^>]*href="([^"]+)"[^>]*>(?:(?!</a>).)*>${label}<`))?.[1];
    expect(href('Money in')).toBe('/add');
    expect(href('Money out')).toBe('/withdraw');
    expect(href('Transfer')).toBe('/transfer');
  });
});

describe('record menu state', () => {
  it('opens on toggle and closes on toggle, escape, scrim, item pick and route change', () => {
    const { nextMenuOpen, menuEventForKey } = menuLib();
    expect(nextMenuOpen(false, 'toggle')).toBe(true);
    expect(nextMenuOpen(true, 'toggle')).toBe(false);
    for (const e of ['escape', 'scrim', 'itemPick', 'routeChange'] as const)
      expect(nextMenuOpen(true, e), e).toBe(false);
    expect(nextMenuOpen(false, 'escape')).toBe(false);
    expect(menuEventForKey('Escape')).toBe('escape');
    expect(menuEventForKey('Enter')).toBeNull();
  });
});
