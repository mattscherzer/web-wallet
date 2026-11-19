import { describe, expect, it } from 'vitest';
import { checkPr, limitsOf } from './pr-checks.mjs';

const body = '## What\nx\n\n## Why\ny\n\n## How it was checked\nz\n';
const limits = { 'max-lines': 300, complexity: 15, 'max-depth': 3, 'max-params': 4 };
const ok = { title: 'feat(ui): add thing', body, changed: [], limits, baseLimits: limits };
const run = (o) => checkPr({ ...ok, ...o }).map((m) => m.split(':')[0]);

describe('PR rules', () => {
  it('passes a clean PR', () => expect(run({})).toEqual([]));
  it('12.1 rejects a free-form title', () => expect(run({ title: 'Add thing' })).toEqual(['12.1']));
  it('12.3 rejects an empty section', () =>
    expect(run({ body: '## What\n\n## Why\ny\n## How it was checked\nz' })).toEqual(['12.3']));
  it('12.3 ignores template comments', () =>
    expect(run({ body: '## What\n<!-- x -->\n## Why\ny\n## How it was checked\nz' })).toEqual(['12.3']));
  it('11.1 rejects editing a migration', () =>
    expect(run({ changed: [{ status: 'M', path: 'supabase/migrations/1.sql' }] })).toEqual(['11.1']));
  it('11.4 needs a backup note for data changes', () => {
    const c = {
      changed: [{ status: 'A', path: 'supabase/migrations/2.sql' }],
      sql: { 'supabase/migrations/2.sql': 'UPDATE t SET a = 1;' },
    };
    expect(run(c)).toEqual(['11.4']);
    expect(run({ ...c, body: `${body}A backup is needed.` })).toEqual([]);
  });
  it('8.6 needs a test with a fix', () => {
    expect(run({ title: 'fix: bug', changed: [{ status: 'M', path: 'src/a.ts' }] })).toEqual(['8.6']);
    expect(run({ title: 'fix: bug', changed: [{ status: 'M', path: 'src/a.test.ts' }] })).toEqual([]);
  });
  it('8.5 flags lost assertions unless explained', () => {
    const a = [{ path: 'src/a.test.ts', before: 3, after: 2 }];
    expect(run({ assertions: a })).toEqual(['8.5']);
    expect(run({ assertions: a, body: `${body}Assertions removed: behaviour changed` })).toEqual([]);
  });
  it('12.5 and 12.4 reject a raised limit without a record', () => {
    const raised = { limits: { ...limits, complexity: 20 } };
    expect(run(raised)).toEqual(['12.5', '12.4']);
    expect(run({ ...raised, changed: [{ status: 'A', path: 'docs/decisions/x.md' }] })).toEqual(['12.5']);
  });
  it('12.4 needs a record for a new dependency or folder', () => {
    expect(run({ newDeps: ['left-pad'] })).toEqual(['12.4']);
    expect(run({ newFolders: ['src/lib'] })).toEqual(['12.4']);
  });
  it('14.1 makes a change to the enforcement visible to a person', () => {
    const c = { changed: [{ status: 'M', path: 'eslint.config.js' }] };
    expect(run(c)).toEqual(['14.1']);
    expect(run({ ...c, body: `${body}Standards change: new rule` })).toEqual([]);
  });
  it('5.7 needs a justification for new eslint-disable lines', () => {
    expect(run({ disablesAdded: 1 })).toEqual(['5.7']);
    expect(run({ disablesAdded: 1, body: `${body}Disables added: backdrop` })).toEqual([]);
  });
  it('reads the limits out of eslint.config.js', () =>
    expect(limitsOf("'max-lines': ['error', { max: 300 }], complexity: ['error', 15]")).toMatchObject({
      'max-lines': 300,
      complexity: 15,
    }));
});
