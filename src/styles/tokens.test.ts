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
  ['color-text-primary', 'color-bg-secondary', 4.5],
  ['color-text-primary', 'color-reserve-bg', 4.5],
  ['color-text-secondary', 'color-bg', 4.5],
  ['color-text-secondary', 'color-card', 4.5],
  ['color-text-secondary', 'color-bg-secondary', 4.5],
  ['color-text-secondary', 'color-reserve-bg', 4.5],
  ['color-in', 'color-card', 4.5],
  ['color-in', 'color-bg', 4.5],
  ['color-in', 'color-in-surface', 4.5],
  ['color-error', 'color-card', 4.5],
  ['color-error', 'color-bg', 4.5],
  ['color-text-inverse', 'color-primary', 4.5],
  ['color-hero-text', 'color-hero-bg', 4.5],
  ['color-hero-text-secondary', 'color-hero-bg', 4.5],
  ['color-hero-action-text', 'color-hero-action-bg', 4.5],
  ['color-border', 'color-card', 3],
  ['color-border', 'color-bg', 3],
  ['color-focus', 'color-card', 3],
  ['color-focus', 'color-bg', 3],
  ['color-hero-focus', 'color-hero-bg', 3],
  ['color-hero-action-border', 'color-hero-bg', 3],
  ['color-hero-action-text', 'color-hero-action-hover-bg', 4.5],
  ['color-text-inverse', 'color-primary-hover', 4.5],
  ['color-link-hover', 'color-card', 4.5],
  ['color-link-hover', 'color-bg', 4.5],
  ['color-text-primary', 'color-in-surface', 4.5],
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

  it('keeps literal radii small (no pills); larger radii come from tokens', () => {
    const literals = [...rest.matchAll(/border-radius:\s*([\d.]+)px/g)].map((m) => parseFloat(m[1]));
    for (const r of literals) expect(r).toBeLessThanOrEqual(10);
    expect(rest).not.toMatch(/border-radius:\s*(9999px|var\(--radius-full\))/);
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
