import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import BottomNav from './BottomNav';

function nav(path = '/') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

/** Labels of the links whose tag carries aria-current="page". */
function currentLabels(html: string): string[] {
  const links = html.match(/<a [^>]*>.*?<\/a>/g) ?? [];
  return links
    .filter((a) => a.includes('aria-current="page"'))
    .map((a) => a.replace(/<[^>]+>/g, ''));
}

describe('BottomNav destinations', () => {
  it('lists Overview, History, Reports and More in order, without Add or Withdraw', () => {
    const html = nav();
    const positions = ['Overview', 'History', 'Reports', 'More'].map((l) => html.indexOf(`>${l}<`));
    expect(positions.every((p) => p > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).not.toMatch(/>(Add|Withdraw|Dashboard)</);
    expect(html).toContain('aria-label="Main"');
  });

  it('marks only the current destination as the current page', () => {
    expect(currentLabels(nav('/'))).toEqual(['Overview']);
    expect(currentLabels(nav('/history'))).toEqual(['History']);
    expect(currentLabels(nav('/reports'))).toEqual(['Reports']);
    expect(currentLabels(nav('/more'))).toEqual(['More']);
  });
});
