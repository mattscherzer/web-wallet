import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Amount from './Amount';

describe('Amount', () => {
  it('renders money in with sign, word tag and screen-reader text before the figure', () => {
    const html = renderToStaticMarkup(<Amount type="inflow" amount={145.5} locale="en" />);
    expect(html).toContain('+€145.50');
    expect(html).toContain('amount--inflow');
    expect(html.indexOf('Money in')).toBeGreaterThan(-1);
    expect(html.indexOf('Money in')).toBeLessThan(html.indexOf('+€145.50'));
    expect(html).toMatch(/<span class="amount__tag"[^>]*aria-hidden="true">In<\/span>/);
  });

  it('renders money out with a true minus', () => {
    const html = renderToStaticMarkup(<Amount type="outflow" amount={60} locale="en" />);
    expect(html).toContain('−€60.00');
    expect(html).toContain('amount--outflow');
    expect(html.indexOf('Money out')).toBeLessThan(html.indexOf('−€60.00'));
    expect(html).toContain('>Out</span>');
  });

  it('renders transfers without a sign', () => {
    const html = renderToStaticMarkup(<Amount type="transfer" amount={150} locale="en" />);
    expect(html).toContain('€150.00');
    expect(html).not.toMatch(/[+−]€150/);
    expect(html).toContain('amount--transfer');
    expect(html.indexOf('Transfer')).toBeLessThan(html.indexOf('€150.00'));
  });

  it('uses tabular figures and the requested locale', () => {
    const html = renderToStaticMarkup(<Amount type="inflow" amount={1210.3} locale="de" />);
    expect(html).toContain('class="amount__figure num"');
    expect(html).toContain('+1.210,30 €');
  });
});
