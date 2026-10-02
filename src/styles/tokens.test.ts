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
];

describe('design tokens', () => {
  it('defines a light and a dark token block', () => {
    expect(Object.keys(tokens(lightBlock)).length).toBeGreaterThan(20);
    expect(Object.keys(tokens(darkBlock)).length).toBeGreaterThan(10);
  });

  it('uses the Clear Navy palette', () => {
    const light = tokens(lightBlock);
    expect(light['color-bg'].toLowerCase()).toBe('#f4f5f7');
    expect(light['color-card'].toLowerCase()).toBe('#ffffff');
    expect(light['color-text-primary'].toLowerCase()).toBe('#101828');
    expect(light['color-text-secondary'].toLowerCase()).toBe('#5d6675');
    expect(light['color-primary'].toLowerCase()).toBe('#0b2545');
    expect(light['color-in'].toLowerCase()).toBe('#067647');
    expect(light['color-error'].toLowerCase()).toBe('#b42318');
    expect(light['color-reserve-bg'].toLowerCase()).toBe('#eaeff7');
    expect(light['color-focus'].toLowerCase()).toBe('#1f4e9e');
    const dark = tokens(darkBlock);
    expect(dark['color-bg'].toLowerCase()).toBe('#0b0f17');
    expect(dark['color-card'].toLowerCase()).toBe('#141a24');
    expect(dark['color-text-primary'].toLowerCase()).toBe('#f2f4f7');
    expect(dark['color-in'].toLowerCase()).toBe('#47cd89');
    expect(dark['color-focus'].toLowerCase()).toBe('#8ab4f8');
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

  it('uses Geist and none of the earlier typefaces', () => {
    expect(css).toMatch(/--font-family:\s*'Geist'/);
    expect(css).toMatch(/--font-mono:\s*'Geist Mono'/);
    expect(css).not.toMatch(/Inter|Newsreader|Public Sans|IBM Plex/);
    expect(css).not.toMatch(/#1a1f71|#3f51b5|#5c6bc0/i);
  });

  it('has no pill-shaped radius on controls, chips or marks', () => {
    expect(rest).not.toMatch(/border-radius:\s*(9999px|var\(--radius-full\)|2[2-9]px)/);
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

  it('draws a 3px focus ring offset by 2px on every focusable element', () => {
    expect(rest).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--color-focus\)[^}]*outline-offset:\s*2px/);
  });
});
