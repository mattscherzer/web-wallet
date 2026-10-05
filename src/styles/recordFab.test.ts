/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Top-level blocks as [header, body], by balanced braces. */
function blocks(text: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let depth = 0;
  let start = 0;
  let headerStart = 0;
  let header = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) {
        header = text.slice(headerStart, i).trim();
        start = i + 1;
      }
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        out.push([header, text.slice(start, i)]);
        headerStart = i + 1;
      }
    }
  }
  return out;
}

const top = blocks(css);
const motionOk = blocks(
  top.filter(([h]) => h === '@media (prefers-reduced-motion: no-preference)').map(([, b]) => b).join('\n'),
);
const outsideMedia = top.filter(([h]) => !h.startsWith('@media'));
const baseRule = (sel: string) => outsideMedia.find(([h]) => h === sel)?.[1] ?? '';
const zIndex = (sel: string) => Number(baseRule(sel).match(/z-index:\s*(\d+)/)?.[1] ?? NaN);

describe('record menu motion and layering', () => {
  it('items are visible by default and only animate when motion is allowed', () => {
    const base = baseRule('.record-menu__item');
    expect(base, '.record-menu__item base rule must exist').not.toBe('');
    expect(base).not.toMatch(/animation/);
    expect(base).not.toMatch(/opacity:\s*0/);
    const animated = motionOk.find(([h]) => h === '.record-menu__item')?.[1] ?? '';
    expect(animated).toMatch(/animation:/);
    expect(animated).toMatch(/animation-delay:[^;]*var\(--i\)[^;]*40ms/);
    expect(css).toMatch(/@keyframes\s+record-menu-in/);
  });

  it('stacks scrim under the menu and FAB, and all under the nav bar', () => {
    const scrim = zIndex('.record-scrim');
    expect(scrim).toBeGreaterThan(0);
    expect(zIndex('.record-menu')).toBeGreaterThan(scrim);
    expect(zIndex('.record-fab')).toBeGreaterThan(scrim);
    expect(zIndex('.record-fab')).toBeLessThan(zIndex('.bottom-nav'));
  });

  it('keeps the global reduced-motion rule that disables animations', () => {
    const reduce = top.find(([h]) => h === '@media (prefers-reduced-motion: reduce)')?.[1] ?? '';
    expect(reduce).toMatch(/animation:\s*none\s*!important/);
  });
});
