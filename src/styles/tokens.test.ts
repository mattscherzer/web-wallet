/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

/** Split the stylesheet into top-level blocks: [header, body]. */
function topLevelBlocks(source: string): Array<[string, string]> {
  const blocks: Array<[string, string]> = [];
  let depth = 0;
  let start = 0;
  let headerStart = 0;
  let header = '';
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
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
        blocks.push([header, text.slice(start, i)]);
        headerStart = i + 1;
      }
    }
  }
  return blocks;
}

const blocks = topLevelBlocks(css);
const lightBlock = blocks.find(([h]) => h === ':root')?.[1] ?? '';
const darkMedia = blocks.find(([h]) => h === '@media (prefers-color-scheme: dark)')?.[1] ?? '';
const darkBlock = topLevelBlocks(darkMedia).find(([h]) => h === ':root')?.[1] ?? '';
const rest = blocks
  .filter(([h]) => h !== ':root' && h !== '@media (prefers-color-scheme: dark)')
  .map(([h, b]) => `${h}{${b}}`)
  .join('\n');

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// [foreground token, background token, minimum ratio]
const PAIRS: Array<[string, string, number]> = [
  ['color-text-primary', 'color-bg', 4.5],
  ['color-text-primary', 'color-card', 4.5],
  ['color-text-primary', 'color-container', 4.5],
  ['color-text-primary', 'color-bg-secondary', 4.5],
  ['color-text-primary', 'color-avatar', 4.5],
  ['color-text-primary', 'color-in-surface', 4.5],
  ['color-text-secondary', 'color-bg', 4.5],
  ['color-text-secondary', 'color-card', 4.5],
  ['color-text-secondary', 'color-container', 4.5],
  ['color-text-secondary', 'color-bg-secondary', 4.5],
  ['color-text-secondary', 'color-avatar', 4.5],
  ['color-in', 'color-card', 4.5],
  ['color-in', 'color-bg', 4.5],
  ['color-in', 'color-in-surface', 4.5],
  ['color-error', 'color-card', 4.5],
  ['color-error', 'color-bg', 4.5],
  ['color-error', 'color-bg-secondary', 4.5],
  ['color-text-inverse', 'color-primary', 4.5],
  ['color-text-inverse', 'color-primary-hover', 4.5],
  ['color-on-primary-container', 'color-primary-container', 4.5],
  ['color-hero-text', 'color-hero-bg', 4.5],
  ['color-hero-text-secondary', 'color-hero-bg', 4.5],
  ['color-hero-action-text', 'color-hero-action-bg', 4.5],
  ['color-hero-action-text', 'color-hero-action-hover-bg', 4.5],
  ['color-link-hover', 'color-card', 4.5],
  ['color-link-hover', 'color-bg', 4.5],
  ['color-hero-action-bg', 'color-hero-bg', 3],
  ['color-border', 'color-card', 3],
  ['color-border', 'color-bg', 3],
  ['color-border', 'color-container', 3],
  ['color-border', 'color-bg-secondary', 3],
  ['color-focus', 'color-primary-container', 3],
  ['color-hero-text-secondary', 'color-hero-decor', 4.5],
  ['color-focus', 'color-card', 3],
  ['color-focus', 'color-bg', 3],
  ['color-focus', 'color-container', 3],
  ['color-focus', 'color-bg-secondary', 3],
  ['color-hero-focus', 'color-hero-bg', 3],
];

describe('design tokens', () => {
  it('defines a light and a dark token block', () => {
    expect(Object.keys(tokens(lightBlock)).length).toBeGreaterThan(20);
    expect(Object.keys(tokens(darkBlock)).length).toBeGreaterThan(10);
  });

  describe.each([
    ['light', () => tokens(lightBlock)],
    ['dark', () => ({ ...tokens(lightBlock), ...tokens(darkBlock) })],
  ])('%s contrast', (_name, get) => {
    it.each(PAIRS)('%s on %s is at least %s:1', (fg, bg, min) => {
      const t = get();
      expect(t[fg], `missing ${fg}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t[bg], `missing ${bg}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
    });
  });
});

describe('stylesheet rules', () => {
  it('keeps colours inside the token blocks', () => {
    expect(rest.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(rest.match(/\brgba?\(/g) ?? []).toEqual([]);
  });

  it('has no gradients at all', () => {
    expect(css).not.toMatch(/gradient\(/);
  });

  it('uses Geist', () => {
    expect(css).toMatch(/--font-family:\s*'Geist'/);
    expect(css).toMatch(/--font-mono:\s*'Geist Mono'/);
  });

  it('takes large corner radii from tokens, not literals', () => {
    const literals = [...rest.matchAll(/border-radius:\s*([\d.]+)px/g)].map((m) => parseFloat(m[1]));
    for (const r of literals) expect(r).toBeLessThanOrEqual(12);
  });

  it('gives the balance card an asymmetric hero corner', () => {
    expect(rest).toMatch(
      /\.balance-hero\s*\{[^}]*border-radius:\s*var\(--radius-hero-start\)\s+var\(--radius-xl\)\s+var\(--radius-xl\)\s+var\(--radius-xl\)/,
    );
  });

  it('segments lists: 2px gaps, large outer corners, small inner corners', () => {
    expect(rest).toMatch(/\.segmented-list\s*\{[^}]*gap:\s*2px/);
    expect(rest).toMatch(
      /\.segmented-list > :first-child\s*\{[^}]*border-radius:\s*var\(--radius-lg\) var\(--radius-lg\) var\(--radius-xs\) var\(--radius-xs\)/,
    );
    expect(rest).toMatch(
      /\.segmented-list > :last-child\s*\{[^}]*border-radius:\s*var\(--radius-xs\) var\(--radius-xs\) var\(--radius-lg\) var\(--radius-lg\)/,
    );
    expect(rest).toMatch(/\.segmented-list > :only-child\s*\{[^}]*border-radius:\s*var\(--radius-lg\)/);
  });

  describe('motion', () => {
    const motion = blocks.find(([h]) => h === '@media (prefers-reduced-motion: no-preference)')?.[1] ?? '';
    const reduced = blocks.find(([h]) => h === '@media (prefers-reduced-motion: reduce)')?.[1] ?? '';
    const pressed = [
      '.btn',
      '.btn--cash-calc',
      '.balance-hero__action',
      '.fab',
      '.chip',
      '.filter-pill',
      '.payment-card',
      '.transaction-item__action-btn',
      '.count-icon-btn',
      '.count-tile',
    ];

    it('defines the press spring only when motion is allowed', () => {
      expect(motion).toMatch(/transform:\s*scale\(0\.94\)/);
      expect(motion).toMatch(/border-radius:\s*var\(--radius-md\)/);
      expect(rest.replace(motion, '')).not.toMatch(/scale\(0\.94\)/);
    });

    it.each(pressed)('presses %s, but never while disabled', (sel) => {
      expect(motion).toContain(`${sel}:not(:disabled):active`);
    });

    it('presses the navigation indicator', () => {
      expect(motion).toMatch(/\.bottom-nav__item:active \.bottom-nav__icon-wrap/);
    });

    it('uses the spatial spring for movement and the effects spring for shape and colour', () => {
      expect(lightBlock).toMatch(/--transition-spring:\s*350ms cubic-bezier\(0\.34, 1\.56, 0\.64, 1\)/);
      expect(lightBlock).toMatch(/--transition-effects:\s*200ms cubic-bezier\(0\.2, 0, 0, 1\)/);
    });

    it('stops all animations and transitions for reduced motion', () => {
      expect(reduced).toMatch(/animation:\s*none\s*!important/);
      expect(reduced).toMatch(/transition:\s*none\s*!important/);
    });
  });

  it('sizes controls from the touch tokens', () => {
    expect(lightBlock).toMatch(/--touch-min:\s*48px/);
    expect(lightBlock).toMatch(/--touch-primary:\s*56px/);
    expect(rest).toMatch(/\.btn\s*\{[^}]*min-height:\s*var\(--touch-min\)/);
    expect(rest).toMatch(/\.btn--primary\s*\{[^}]*min-height:\s*var\(--touch-primary\)/);
    expect(rest).toMatch(/\.fab\s*\{[^}]*width:\s*var\(--fab-size\)/);
    expect(lightBlock).toMatch(/--fab-size:\s*80px/);
    expect(rest).toMatch(/\.search-bar__input\s*\{[^}]*min-height:\s*var\(--touch-min\)/);
  });

  it('keeps the decorative cookie out of the balance figure', () => {
    const deco = rest.match(/\.balance-hero::after\s*\{([^}]*)\}/)?.[1] ?? '';
    const px = (prop: string) => parseFloat(deco.match(new RegExp(`${prop}:\\s*(-?[\\d.]+)px`))?.[1] ?? 'NaN');
    // the figure's line box starts about 49px below the top of the card (24px padding + 21px label + 4px margin)
    expect(px('top') + px('height')).toBeLessThanOrEqual(48);
  });

  it('gives every placeholder the secondary ink colour', () => {
    const placeholders = [...rest.matchAll(/([^{}]*::placeholder)\s*\{([^}]*)\}/g)];
    expect(rest).toMatch(/\.search-bar__input::placeholder/);
    expect(rest).toMatch(/\.amount-input__value::placeholder/);
    for (const [, , body] of placeholders) {
      expect(body).toMatch(/color:\s*var\(--color-text-secondary\)/);
      expect(body).toMatch(/opacity:\s*1/);
    }
  });

  it('rings the navigation indicator, not the edge-to-edge item', () => {
    expect(rest).toMatch(/\.bottom-nav__item:focus-visible\s*\{[^}]*outline:\s*none/);
    expect(rest).toMatch(
      /\.bottom-nav__item:focus-visible \.bottom-nav__icon-wrap\s*\{[^}]*outline:\s*3px solid var\(--color-focus\)[^}]*outline-offset:\s*2px/,
    );
  });

  it('keeps the rail and FAB inside the safe area and the layout box', () => {
    expect(css).toMatch(/--rail-offset:\s*calc\(var\(--rail-width\) \+ env\(safe-area-inset-left/);
    expect(css).not.toMatch(/100vw/);
    expect(rest).toMatch(/\.bottom-nav\s*\{[^}]*width:\s*var\(--rail-offset\)/);
    expect(rest).toMatch(/\.app-layout\s*\{[^}]*margin:[^;}]*max\(var\(--rail-offset\)/);
    expect(rest).toMatch(/\.fab\s*\{[^}]*left:[^;}]*max\(var\(--rail-offset\)/);
    expect(rest).toMatch(/\.page-container\s*\{[^}]*safe-area-inset-bottom/);
  });

  it('does not apply hover styles to disabled buttons', () => {
    for (const sel of ['.btn--primary', '.btn--outline', '.btn--cash-calc']) {
      expect(rest).toContain(`${sel}:hover:not(:disabled)`);
    }
    expect(rest).not.toMatch(/\.btn--[\w-]+:hover\s*\{/);
  });

  it('keeps green for money in only, never for links', () => {
    const linkRules = [...rest.matchAll(/([^{}]*\ba\b[^{}]*|[^{}]*btn--link[^{}]*)\{([^}]*)\}/g)].map((m) => m[2]);
    for (const body of linkRules) expect(body).not.toMatch(/--color-in\b/);
  });

  it('does not recolour every anchor on hover (it leaks onto nav items)', () => {
    expect(rest).not.toMatch(/(^|\n)a:hover/);
  });

  it('never sets text below 12px', () => {
    const sizes = [...rest.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)].map((m) =>
      m[2] === 'rem' ? parseFloat(m[1]) * 16 : parseFloat(m[1]),
    );
    const tokenSizes = [...lightBlock.matchAll(/--font-size-[\w-]+:\s*([\d.]+)(px|rem)/g)].map((m) =>
      m[2] === 'rem' ? parseFloat(m[1]) * 16 : parseFloat(m[1]),
    );
    for (const size of [...sizes, ...tokenSizes]) expect(size).toBeGreaterThanOrEqual(12);
  });

  it('uses a contrasting focus ring on the navy balance card', () => {
    expect(rest).toMatch(/\.balance-hero :focus-visible\s*\{[^}]*outline-color:\s*var\(--color-hero-focus\)/);
  });

  it('draws a 3px focus ring offset by 2px on every focusable element', () => {
    expect(rest).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--color-focus\)[^}]*outline-offset:\s*2px/);
  });
});
