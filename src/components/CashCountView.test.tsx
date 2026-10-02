import { describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CountState } from '../utils/cashCount';

// Loaded dynamically so a missing module fails the assertion below instead of crashing the file.
const view = await import('./CashCountView').catch(() => undefined);
const logic = await import('../utils/cashCount').catch(() => undefined);

function render(state?: CountState) {
  expect(view, 'src/components/CashCountView.tsx must exist').toBeDefined();
  expect(logic, 'src/utils/cashCount.ts must exist').toBeDefined();
  const { CashCountView } = view!;
  return renderToStaticMarkup(
    <CashCountView
      state={state ?? logic!.initialCountState()}
      dispatch={vi.fn()}
      onApply={vi.fn()}
      onClose={vi.fn()}
      locale="en"
    />,
  );
}

/** The opening tag of the first element whose markup contains `needle`. */
function tagWith(html: string, needle: string): string {
  const at = html.indexOf(needle);
  expect(at, `"${needle}" not found`).toBeGreaterThan(-1);
  const start = html.lastIndexOf('<', at);
  return html.slice(start, html.indexOf('>', at) + 1);
}

const counted = (patch: Record<number, number>, mode: CountState['mode'] = 'add'): CountState => {
  const counts = new Array(12).fill(0);
  for (const [i, n] of Object.entries(patch)) counts[Number(i)] = n;
  return { counts, mode, history: [] };
};

describe('CashCountView layout', () => {
  it('has header with Back, title and Clear', () => {
    const html = render();
    expect(html).toContain('Count cash');
    expect(html).toMatch(/aria-label="Back to the form"/);
    expect(html).toMatch(/>Clear</);
  });

  it('has the Counted card, Notes and Coins sections', () => {
    const html = render();
    expect(html).toContain('Counted');
    expect(html).toMatch(/>Notes</);
    expect(html).toMatch(/>Coins</);
    expect(html).toContain('0 notes · 0 coins');
  });

  it('lists the twelve denominations in order', () => {
    const html = render();
    const labels = ['€50', '€20', '€10', '€5', '€2', '€1', '50c', '20c', '10c', '5c', '2c', '1c'];
    const positions = labels.map((l) => html.indexOf(`>${l}<`));
    expect(positions.every((p) => p > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('has the Add / Remove / Type toolbar and Undo', () => {
    const html = render();
    expect(html).toContain('✓ Add');
    expect(html).toMatch(/>Remove</);
    expect(html).toMatch(/>Type</);
    expect(html).toMatch(/aria-label="Undo last tap"/);
  });

  it('announces the total politely', () => {
    const html = render();
    expect(html).toMatch(/aria-live="polite"[^>]*>€0\.00</);
  });
});

describe('CashCountView modes', () => {
  it('Add mode: hint, pressed segment and add labels', () => {
    const html = render(counted({ 0: 2 }));
    expect(html).toContain('Tap a note or coin to add one.');
    expect(tagWith(html, '✓ Add')).toContain('aria-pressed="true"');
    expect(tagWith(html, '>Remove<')).toContain('aria-pressed="false"');
    expect(html).toContain('€50 notes: 2. Tap to add one');
    expect(html).toContain('50c coins: 0. Tap to add one');
  });

  it('Remove mode: hint, pressed segment and remove labels', () => {
    const html = render(counted({ 0: 2 }, 'remove'));
    expect(html).toContain('Removing: tap a note or coin to take one away.');
    expect(tagWith(html, '✓ Remove')).toContain('aria-pressed="true"');
    expect(tagWith(html, '>Add<')).toContain('aria-pressed="false"');
    expect(html).toContain('€50 notes: 2. Tap to remove one');
  });

  it('Type mode: numeric inputs replace the tiles', () => {
    const html = render(counted({ 0: 2 }, 'type'));
    expect(html).toContain('Type how many of each you counted.');
    expect(tagWith(html, '✓ Type')).toContain('aria-pressed="true"');
    expect(html).not.toContain('Tap to add one');
    const input = tagWith(html, 'aria-label="Number of €50 notes"');
    expect(input).toContain('inputMode="numeric"');
    expect(input).toContain('value="2"');
    expect(html).toContain('aria-label="Number of 1c coins"');
  });

  it('Type mode: a zero count is an empty field with a 0 placeholder, so typing 1 gives 1', () => {
    const html = render(counted({ 0: 2 }, 'type'));
    const empty = tagWith(html, 'aria-label="Number of €20 notes"');
    expect(empty).toContain('placeholder="0"');
    expect(empty).toContain('value=""');
    expect(empty).not.toContain('value="0"');
    expect(tagWith(html, 'aria-label="Number of €50 notes"')).toContain('value="2"');
  });
});

describe('CashCountView counted state', () => {
  it('shows badge, subtotal, total and piece summary', () => {
    const html = render(counted({ 0: 2, 8: 3, 11: 1 }));
    expect(html).toContain('€100.00');
    expect(html).toContain('€0.30');
    // 2 x 50 + 3 x 0.10 + 1 x 0.01
    expect(html).toContain('€100.31');
    expect(html).toContain('2 notes · 4 coins');
    expect(html).toContain('Use €100.31 as amount');
  });

  it('shows a dash subtotal for empty tiles', () => {
    expect(render()).toContain('>—<');
  });
});

describe('CashCountView actions', () => {
  it('disables Undo when there is no history and enables it otherwise', () => {
    expect(tagWith(render(), 'aria-label="Undo last tap"')).toContain('disabled');
    const withHistory = { ...counted({ 0: 1 }), history: [new Array(12).fill(0)] };
    expect(tagWith(render(withHistory), 'aria-label="Undo last tap"')).not.toContain('disabled');
  });

  it('disables the apply button at a zero total only', () => {
    expect(tagWith(render(), 'Use €0.00 as amount')).toContain('disabled');
    expect(tagWith(render(counted({ 0: 1 })), 'Use €50.00 as amount')).not.toContain('disabled');
  });
});

/** Walk the element tree returned by calling the (hook-free) view as a function. */
function findButton(node: ReactNode, label: string, tag = 'button'): ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findButton(child, label, tag);
      if (hit) return hit;
    }
    return undefined;
  }
  if (!isValidElement<Record<string, unknown>>(node)) return undefined;
  const text = [node.props.children].flat().filter((c) => typeof c === 'string').join('');
  if (node.type === tag && (node.props['aria-label'] === label || text === label)) return node;
  return findButton(node.props.children as ReactNode, label, tag);
}

function press(label: string, state: CountState) {
  expect(view, 'src/components/CashCountView.tsx must exist').toBeDefined();
  const onApply = vi.fn();
  const onClose = vi.fn();
  const dispatch = vi.fn();
  const tree = view!.CashCountView({ state, dispatch, onApply, onClose, locale: 'en' });
  const button = findButton(tree, label);
  expect(button, `button "${label}" not found`).toBeDefined();
  (button!.props.onClick as () => void)();
  return { onApply, onClose, dispatch };
}

/** Fire a handler on a count field, as the browser would, with the text it holds. */
function fireField(label: string, state: CountState, handler: 'onChange' | 'onBlur', text = '') {
  expect(view, 'src/components/CashCountView.tsx must exist').toBeDefined();
  const dispatch = vi.fn();
  const tree = view!.CashCountView({ state, dispatch, onApply: vi.fn(), onClose: vi.fn(), locale: 'en' });
  const field = findButton(tree, label, 'input');
  expect(field, `field "${label}" not found`).toBeDefined();
  (field!.props[handler] as (e: unknown) => void)({ currentTarget: { value: text } });
  return dispatch;
}

describe('CashCountView wiring', () => {
  it('hands the form the total in euros, not cents, when applying', () => {
    const counts = new Array(12).fill(0);
    counts[8] = 3; // 3 x 10c
    counts[9] = 1; // 1 x 5c
    counts[11] = 2; // 2 x 1c
    const { onApply, onClose } = press('Use €0.37 as amount', { counts, mode: 'add', history: [] });
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(0.37);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Back closes without applying', () => {
    const { onApply, onClose } = press('Back to the form', counted({ 0: 2 }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('marks counted tiles for the dashed Remove border only in Remove mode', () => {
    expect(tagWith(render(counted({ 0: 2 }, 'remove')), '€50 notes: 2')).toContain('count-tile--remove');
    expect(tagWith(render(counted({ 0: 2 }, 'add')), '€50 notes: 2')).not.toContain('count-tile--remove');
    expect(tagWith(render(counted({}, 'remove')), '€50 notes: 0')).not.toContain('count-tile--remove');
  });

  it('turns the selected segment red only in Remove mode', () => {
    expect(tagWith(render(counted({}, 'remove')), '✓ Remove')).toContain('count-mode--remove');
    expect(tagWith(render(counted({}, 'add')), '✓ Add')).not.toContain('count-mode--remove');
    expect(tagWith(render(counted({}, 'type')), '✓ Type')).not.toContain('count-mode--remove');
  });

  it('draws coins as round faces and notes as plain labels', () => {
    const html = render();
    expect(tagWith(html, '€2 coins: 0')).toContain('count-tile--coin');
    expect(tagWith(html, '1c coins: 0')).toContain('count-tile--coin');
    expect(tagWith(html, '€5 notes: 0')).toContain('count-tile--note');
    expect(tagWith(html, '€5 notes: 0')).not.toContain('count-tile--coin');
  });
});

describe('CashCountView handlers', () => {
  it('tapping a tile adds one in Add mode', () => {
    expect(press('€50 notes: 0. Tap to add one', counted({}, 'add')).dispatch).toHaveBeenCalledWith({ type: 'add', index: 0 });
    expect(press('1c coins: 0. Tap to add one', counted({}, 'add')).dispatch).toHaveBeenCalledWith({ type: 'add', index: 11 });
  });

  it('tapping a tile removes one in Remove mode', () => {
    const { dispatch } = press('€50 notes: 2. Tap to remove one', counted({ 0: 2 }, 'remove'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'remove', index: 0 });
  });

  it('Undo, Clear and the mode segments dispatch their actions', () => {
    expect(press('Undo last tap', counted({ 0: 1 })).dispatch).toHaveBeenCalledWith({ type: 'undo' });
    expect(press('Clear', counted({ 0: 1 })).dispatch).toHaveBeenCalledWith({ type: 'clear' });
    expect(press('Remove', counted({})).dispatch).toHaveBeenCalledWith({ type: 'setMode', mode: 'remove' });
    expect(press('Type', counted({})).dispatch).toHaveBeenCalledWith({ type: 'setMode', mode: 'type' });
  });

  it('typing a count dispatches every keystroke as a typing change, and leaving the field ends the burst', () => {
    const state = counted({ 0: 2 }, 'type');
    expect(fireField('Number of €50 notes', state, 'onChange', '1a2')).toHaveBeenCalledWith({
      type: 'set',
      index: 0,
      value: 12,
      typing: true,
    });
    expect(fireField('Number of €20 notes', state, 'onChange', '')).toHaveBeenCalledWith({
      type: 'set',
      index: 1,
      value: 0,
      typing: true,
    });
    expect(fireField('Number of €50 notes', state, 'onBlur')).toHaveBeenCalledWith({ type: 'set', index: 0, value: 2 });
  });
});
