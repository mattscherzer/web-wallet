// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const files = (dir: string, ext: RegExp): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(`${dir}/${e.name}`, ext) : ext.test(e.name) ? [`${dir}/${e.name}`] : [],
  );

// Rule 11.3: these predate the rollback convention.
const ROLLBACK_EXCEPTIONS = ['20260101000000_initial_schema.sql', '20261007000000_soft_remove.sql'];

describe('coding standards (docs/coding-standards.md)', () => {
  it('rule 2.2: every domain module with runtime exports has a test next to it', () => {
    const missing = readdirSync(join(root, 'src/domain'))
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .filter((f) => /^export (async function|function|const|class|let) /m.test(read(`src/domain/${f}`)))
      .filter((f) => !existsSync(join(root, `src/domain/${f.replace(/\.ts$/, '.test.ts')}`)))
      .map((f) => `src/domain/${f}`);
    expect(missing, `rule 2.2: domain modules without a sibling .test.ts: ${missing.join(', ')}`).toEqual([]);
  });

  it('rule 5.7: every eslint-disable comment says why after --', () => {
    const bad = [...files('src', /\.tsx?$/), ...files('supabase/functions', /\.ts$/)].flatMap((f) =>
      read(f)
        .split('\n')
        .map((line, i) => ({ line, at: `${f}:${i + 1}` }))
        .filter(({ line }) => /(\/\/|\/\*)\s*eslint-disable/.test(line) && !/ -- \S/.test(line))
        .map(({ at }) => at),
    );
    expect(bad, `rule 5.7: eslint-disable without a "-- reason" at ${bad.join(', ')}`).toEqual([]);
  });

  it('rule 4.2: every table created in a migration has row-level security enabled', () => {
    const sql = files('supabase/migrations', /\.sql$/).map((f) => ({ f, text: read(f) }));
    const all = sql.map((s) => s.text).join('\n');
    const bad = sql.flatMap(({ f, text }) =>
      [...text.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?(\w+)/gi)]
        .map((m) => m[1])
        .filter(
          (t) => !new RegExp(`ALTER TABLE (?:ONLY )?(?:public\\.)?${t}\\s+ENABLE ROW LEVEL SECURITY`, 'i').test(all),
        )
        .map((t) => `${t} (${f})`),
    );
    expect(bad, `rule 4.2: no ENABLE ROW LEVEL SECURITY for table ${bad.join(', ')}`).toEqual([]);
  });

  it('rule 11.3: every migration documents its rollback, except the listed old ones', () => {
    const bad = files('supabase/migrations', /\.sql$/)
      .filter((f) => !ROLLBACK_EXCEPTIONS.some((e) => f.endsWith(e)))
      .filter((f) => !/rollback/i.test(read(f)));
    expect(bad, `rule 11.3: migration without a rollback comment: ${bad.join(', ')}`).toEqual([]);
  });
});
