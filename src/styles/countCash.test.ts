/// <reference types="node" />
import { readCss } from '../test/readCss';
import { describe, expect, it } from 'vitest';

const css = readCss().replace(/\/\*[\s\S]*?\*\//g, '');

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

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`rule "${selector}" not found`);
  return match[1];
}

const darkBlock = () => mediaBlocks(css).find(([query]) => query.includes('prefers-color-scheme: dark'))?.[1] ?? '';

describe('count cash matches the design handoff', () => {
  it('stacks the note label and amount at the bottom of the tile, clear of the badge', () => {
    const tile = rule('.count-tile--note');
    expect(tile).toMatch(/align-items:\s*flex-start/);
    expect(tile).toMatch(/justify-content:\s*flex-end/);
    expect(tile).not.toMatch(/space-between/);
    expect(tile).toMatch(/padding:\s*10px 10px 8px/);
    expect(rule('.count-tile')).toMatch(/gap:\s*var\(--space-xs\)/);
    expect(css).toMatch(/--space-xs:\s*4px/);
  });

  it('sets the note label at 22px', () => {
    const face = rule('.count-tile--note .count-tile__face');
    expect(face).toMatch(/font-size:\s*22px/);
    expect(face).toMatch(/line-height:\s*1;/);
  });

  it('puts the grey band behind the toolbar only, and keeps the home-indicator inset inside it', () => {
    expect(rule('.count-footer')).not.toMatch(/background/);
    const toolbar = rule('.count-toolbar');
    expect(toolbar).toMatch(/background:\s*var\(--color-container\)/);
    expect(toolbar).toMatch(/env\(safe-area-inset-bottom/);
  });

  it('spaces the apply button and toolbar as designed', () => {
    const toolbar = rule('.count-toolbar');
    expect(toolbar).toMatch(/padding:\s*12px var\(--page-padding\)/);
    expect(toolbar).toMatch(/gap:\s*12px/);
    expect(rule('.count-apply')).toMatch(/margin:\s*0 var\(--page-padding\) 12px/);
  });

  it('keeps the toolbar bottom spacing, with the home-indicator inset added inside the grey band', () => {
    expect(rule('.count-toolbar')).toMatch(
      /padding:\s*12px var\(--page-padding\) calc\(var\(--space-md\) \+ env\(safe-area-inset-bottom, 0px\)\)/,
    );
    expect(css).toMatch(/--space-md:\s*16px/);
  });

  it('takes the Counted card (32) and tile (16) corners from tokens', () => {
    expect(css).toMatch(/--radius-count-total:\s*32px/);
    expect(css).toMatch(/--radius-tile:\s*16px/);
    expect(rule('.count-total')).toMatch(/border-radius:\s*var\(--radius-count-total\)/);
    expect(rule('.count-tile,\n.count-entry')).toMatch(/border-radius:\s*var\(--radius-tile\)/);
  });

  it('uses the design dark colours for the Counted card and leaves light as it was', () => {
    expect(darkBlock()).toMatch(/--color-count-surface:\s*#5c4300/i);
    expect(darkBlock()).toMatch(/--color-on-count-surface:\s*#ffdf9e/i);
    const light = rule(':root');
    expect(light).toMatch(/--color-count-surface:\s*#ffdf9e/i);
    expect(light).toMatch(/--color-on-count-surface:\s*#261a00/i);
  });

  it('rings coin faces with the soft outline token, defined for light and dark', () => {
    expect(rule(':root')).toMatch(/--color-outline:\s*#c4cad4/i);
    expect(darkBlock()).toMatch(/--color-outline:\s*#(?!c4cad4)[0-9a-f]{6}/i);
    expect(rule('.count-tile--coin .count-tile__face')).toMatch(/border:\s*1\.5px solid var\(--color-outline\)/);
  });

  it('keeps the Counted card compact', () => {
    expect(rule('.count-total')).toMatch(/line-height:\s*normal/);
    expect(rule('.count-total__amount')).toMatch(/line-height:\s*1\.15/);
  });

  it('sets Clear at 15px', () => {
    expect(rule('.count-clear')).toMatch(/font-size:\s*15px/);
  });

  it('keeps the count badge pinned to the tile corner, out of the layout flow', () => {
    const badge = rule('.count-tile__badge');
    expect(badge).toMatch(/position:\s*absolute/);
    expect(badge).toMatch(/top:\s*6px/);
    expect(badge).toMatch(/right:\s*6px/);
  });
});
