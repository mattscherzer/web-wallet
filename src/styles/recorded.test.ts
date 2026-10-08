/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('Recorded screen motion', () => {
  it('animates the burst only when the person has not asked for reduced motion', () => {
    const at = css.indexOf('animation: recorded-burst');
    expect(at, 'the burst animation must exist').toBeGreaterThan(-1);
    const lastMedia = css.slice(0, at).lastIndexOf('@media');
    expect(css.slice(lastMedia, lastMedia + 60)).toContain('prefers-reduced-motion: no-preference');
    // Outside that media query the burst has no animation at all.
    expect(css.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}\n/g, '')).not.toContain('recorded-burst');
  });
});
