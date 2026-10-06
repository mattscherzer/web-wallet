import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const reports = await import('./ReportsPage').catch(() => undefined);
const more = await import('./MorePage').catch(() => undefined);

function page(mod: typeof reports) {
  expect(mod, 'page module must exist').toBeDefined();
  const Page = mod!.default;
  return renderToStaticMarkup(
    <MemoryRouter>
      <Page />
    </MemoryRouter>,
  );
}

describe('placeholder pages', () => {
  it('Reports and More each render a heading', () => {
    expect(page(reports)).toMatch(/<h1[^>]*>Reports<\/h1>/);
    expect(page(more)).toMatch(/<h1[^>]*>More<\/h1>/);
  });

  it('App declares the reports and more routes', () => {
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    expect(app).toMatch(/path="reports"/);
    expect(app).toMatch(/path="more"/);
  });
});
