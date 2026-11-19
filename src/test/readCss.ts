/// <reference types="node" />
import { readFileSync } from 'node:fs';

const ENTRY = new URL('../index.css', import.meta.url);
const IMPORT = /^@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;\s*$/gm;

export function cssImports(): string[] {
  const entry = readFileSync(ENTRY, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...entry.matchAll(IMPORT)].map((m) => m[1]);
}

export function readCss(): string {
  const entry = readFileSync(ENTRY, 'utf8');
  return entry.replace(IMPORT, (_all, path: string) => {
    const file = readFileSync(new URL(path, ENTRY), 'utf8');
    if (!file.trim()) throw new Error(`empty stylesheet: ${path}`);
    return file;
  });
}
