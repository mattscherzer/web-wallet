/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readCss } from '../test/readCss';

const css = readCss().replace(/\/\*[\s\S]*?\*\//g, '');

function block(header: string, from = css): string | null {
  const re = new RegExp(`(^|\\})\\s*${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm');
  return from.match(re)?.[2] ?? null;
}
function tokens(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of source.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const lightTokens = tokens(block(':root') ?? '');
const darkMedia = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
const darkTokens = { ...lightTokens, ...tokens(block(':root', darkMedia) ?? '') };

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

// The classes the lock, unlock and sign-in screens are built from.
const SELECTORS = ['.pin-pad__key', '.pin-dots', '.snackbar', '.unlock-sheet', '.app-bar__lock', '.app-bar__lock--locked'];

describe('lock and sign-in styles', () => {
  it.each(SELECTORS)('%s is styled with design tokens only (no raw colours)', (selector) => {
    const body = block(selector);
    expect(body, `${selector} has no rule`).not.toBeNull();
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });

  // Selectors that must set both a text and a background colour themselves (modifiers fall back to their base rule).
  const BASE: Record<string, string> = { '.app-bar__lock--locked': '.app-bar__lock' };
  const MUST_PAIR = ['.pin-pad__key', '.snackbar', '.app-bar__lock', '.app-bar__lock--locked'];

  it.each([
    ['light', lightTokens],
    ['dark', darkTokens],
  ])('%s: text on its background is readable (AA, 4.5:1) for every pair, and pairs were really checked', (_name, t) => {
    const fgOf = (body: string) => body.match(/(?:^|[;\s])color:\s*var\(--([\w-]+)\)/)?.[1];
    const bgOf = (body: string) => body.match(/background(?:-color)?:\s*var\(--([\w-]+)\)/)?.[1];
    let checked = 0;
    for (const selector of SELECTORS) {
      const body = block(selector) ?? '';
      const base = BASE[selector] ? (block(BASE[selector]) ?? '') : '';
      const fg = fgOf(body) ?? fgOf(base);
      const bg = bgOf(body) ?? bgOf(base);
      if (MUST_PAIR.includes(selector)) {
        expect(fg, `${selector} sets no text colour`).toBeTruthy();
        expect(bg, `${selector} sets no background`).toBeTruthy();
      }
      if (fg && bg) {
        expect(ratio(t[fg], t[bg]), `${selector} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(MUST_PAIR.length);
  });
});

// Everything in access.css, not just the classes above.
const ACCESS = readFileSync(new URL('./access.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const RULES = [...ACCESS.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));

describe('every rule in access.css', () => {
  it('uses design tokens only (no raw colours anywhere in the file)', () => {
    expect(RULES.length).toBeGreaterThan(30);
    expect(ACCESS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });

  it.each([
    ['light', lightTokens],
    ['dark', darkTokens],
  ])('%s: every rule that sets text and background colours keeps them readable (AA)', (_name, t) => {
    let checked = 0;
    for (const { selector, body } of RULES) {
      const fg = body.match(/(?:^|[;\s])color:\s*var\(--([\w-]+)\)/)?.[1];
      const bg = body.match(/background(?:-color)?:\s*var\(--([\w-]+)\)/)?.[1];
      if (!fg || !bg) continue;
      expect(t[fg], `${selector}: unknown token ${fg}`).toBeTruthy();
      expect(t[bg], `${selector}: unknown token ${bg}`).toBeTruthy();
      expect(ratio(t[fg], t[bg]), `${selector} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(8);
  });
});
