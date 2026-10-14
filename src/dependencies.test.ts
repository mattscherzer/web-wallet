import { describe, expect, it } from 'vitest';
import packageJsonRaw from '../package.json?raw';
import lockfileRaw from '../package-lock.json?raw';

// Built at runtime so this file never matches its own search.
const SHIM = 'react-router' + '-dom';

type Manifest = { dependencies?: Record<string, string> };
type Lockfile = { packages: Record<string, Manifest> };

describe('router dependency', () => {
  it('no source or test file imports the router shim', () => {
    const files = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const offenders = Object.entries(files)
      .filter(([, text]) => text.includes(SHIM))
      .map(([path]) => path);
    expect(Object.keys(files).length).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });

  it('declares react-router directly and not the shim', () => {
    const { dependencies = {} } = JSON.parse(packageJsonRaw) as Manifest;
    expect(dependencies['react-router']).toBeDefined();
    expect(dependencies[SHIM]).toBeUndefined();
  });

  it('lockfile has no router shim', () => {
    const { packages } = JSON.parse(lockfileRaw) as Lockfile;
    expect(packages[`node_modules/${SHIM}`]).toBeUndefined();
    const dependents = Object.entries(packages)
      .filter(([, manifest]) => manifest.dependencies?.[SHIM] !== undefined)
      .map(([name]) => name);
    expect(dependents).toEqual([]);
  });
});
