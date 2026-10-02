/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/** Every top-level `@media` block as [query, body], found by brace balancing. */
function mediaBlocks(source: string): Array<[string, string]> {
  const blocks: Array<[string, string]> = [];
  const re = /@media[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let depth = 1;
    let i = re.lastIndex;
    while (depth > 0 && i < source.length) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
      i++;
    }
    blocks.push([m[0].slice(0, -1).trim(), source.slice(re.lastIndex, i - 1)]);
    re.lastIndex = i;
  }
  return blocks;
}

describe('count cash styles', () => {
  it('drops the old calculator modal rules', () => {
    expect(css).not.toMatch(/\.calc-(modal|row|section)/);
  });

  it('keeps .modal-overlay, which the PIN modal still uses', () => {
    expect(css).toMatch(/\.modal-overlay\s*\{/);
  });

  it('only animates count tiles when motion is allowed', () => {
    const tileTransition = /\.count-tile[^{]*\{[^}]*transition:/;
    const outside = css.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
    expect(outside).not.toMatch(tileTransition);
    const allowed = mediaBlocks(css).filter(([q]) => q.includes('no-preference'));
    expect(allowed.some(([, body]) => tileTransition.test(body))).toBe(true);
  });

  it('draws coin faces as circles', () => {
    expect(css).toMatch(/\.count-tile--coin \.count-tile__face\s*\{[^}]*border-radius:\s*50%/);
  });
});
