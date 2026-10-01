import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StatusChip from './StatusChip';
import LockPill from './LockPill';

describe('StatusChip', () => {
  it('labels the edited and removed states with words', () => {
    expect(renderToStaticMarkup(<StatusChip variant="edited" />)).toContain('>Edited<');
    expect(renderToStaticMarkup(<StatusChip variant="removed" />)).toContain('>Removed<');
  });

  it('gives each variant its own modifier class', () => {
    expect(renderToStaticMarkup(<StatusChip variant="edited" />)).toContain('status-chip--edited');
    expect(renderToStaticMarkup(<StatusChip variant="removed" />)).toContain('status-chip--removed');
  });
});

describe('LockPill', () => {
  it('shows who is unlocked and for how long', () => {
    const html = renderToStaticMarkup(<LockPill name="Anna" minutesLeft={58} />);
    expect(html).toContain('Anna · 58 min');
    expect(html).toContain('role="status"');
  });

  it('shows "View only" when nobody is unlocked', () => {
    const html = renderToStaticMarkup(<LockPill />);
    expect(html).toContain('View only');
    expect(html).not.toContain('min');
  });

  it('is not focusable', () => {
    const html = renderToStaticMarkup(<LockPill name="Anna" minutesLeft={58} />);
    expect(html).not.toMatch(/<button|tabindex/i);
  });
});
