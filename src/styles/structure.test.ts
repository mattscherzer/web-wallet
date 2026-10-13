/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cssImports } from '../test/readCss';

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const entry = strip(readFileSync(new URL('../index.css', import.meta.url), 'utf8'));
const fileUrl = (p: string) => new URL(p, new URL('../index.css', import.meta.url));

/** Top-level blocks as [header, body] by balanced braces. */
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

function duplicates(headers: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const h of headers.map((x) => x.replace(/\s+/g, ' '))) {
    if (seen.has(h)) dup.add(h);
    seen.add(h);
  }
  return [...dup];
}

function sourceFiles(dir: URL): URL[] {
  return readdirSync(dir).flatMap((name) => {
    const url = new URL(name, dir.href.endsWith('/') ? dir : new URL(dir.href + '/'));
    if (statSync(url).isDirectory()) return name === 'assets' ? [] : sourceFiles(url);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [url] : [];
  });
}

describe('stylesheet structure', () => {
  const imports = cssImports();

  it('index.css holds only imports, with the design tokens first', () => {
    expect(imports.length).toBeGreaterThan(5);
    expect(imports[0]).toMatch(/tokens\.css$/);
    expect(entry.replace(/@import[^;]*;/g, '').trim()).toBe('');
    for (const p of imports) expect(p).toMatch(/^\.\/styles\/[\w-]+\.css$/);
  });

  it('no stylesheet file is longer than 500 lines', () => {
    expect(imports.length).toBeGreaterThan(0);
    for (const p of imports) {
      const lines = readFileSync(fileUrl(p), 'utf8').split('\n').length;
      expect(lines, p).toBeLessThanOrEqual(500);
    }
  });

  it('no top-level selector or @media query is defined twice', () => {
    expect(imports.length).toBeGreaterThan(0);
    const all = imports.flatMap((p) => blocks(strip(readFileSync(fileUrl(p), 'utf8'))));
    const plain = all.filter(([h]) => !h.startsWith('@media')).map(([h]) => h);
    expect(duplicates(plain)).toEqual([]);
    for (const [q, body] of all.filter(([h]) => h.startsWith('@media'))) {
      expect(duplicates(blocks(body).map(([h]) => h)), q).toEqual([]);
    }
  });
});

describe('inline styles', () => {
  it('components set only CSS custom properties inline', () => {
    const offenders: string[] = [];
    for (const url of sourceFiles(new URL('../', import.meta.url))) {
      const src = readFileSync(url, 'utf8');
      for (const m of src.matchAll(/style=\{\{([^}]*)\}\}/g)) {
        const keys = [...m[1].matchAll(/(?:^|,)\s*['"]?([\w-]+)['"]?\s*:/g)].map((k) => k[1]);
        if (keys.some((k) => !k.startsWith('--'))) offenders.push(`${url.pathname}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
