import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CashCalculator from './CashCalculator';

const render = (isOpen: boolean) =>
  renderToStaticMarkup(<CashCalculator isOpen={isOpen} onClose={vi.fn()} onApply={vi.fn()} />);

describe('CashCalculator overlay', () => {
  it('renders nothing while closed', () => {
    expect(render(false)).toBe('');
  });

  it('renders the Count cash screen as a modal dialog when open', () => {
    const html = render(true);
    expect(html).toContain('Count cash');
    expect(html).toMatch(/role="dialog"/);
    expect(html).toMatch(/aria-modal="true"/);
    expect(html).not.toContain('Cash Calculator');
    expect(html).toContain('Tap a note or coin to add one.');
  });
});
