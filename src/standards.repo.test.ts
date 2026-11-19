// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { files, read, must } from './test/repoFiles';

const migrations = () => files('supabase/migrations', /\.sql$/).map((f) => ({ f, sql: read(f) }));
const shared = () => files('supabase/functions/_shared', /\.ts$/).filter((f) => !f.endsWith('.test.ts'));

const RUNTIME_DEPENDENCIES = ['@supabase/supabase-js', 'lucide-react', 'react', 'react-dom', 'react-router'];

describe('coding standards: repository', () => {
  it('rule 9.7: runtime dependencies are the approved list', () => {
    const declared = Object.keys(JSON.parse(read('package.json')).dependencies).sort();
    expect(
      declared,
      'rule 9.7: new runtime dependency: justify it in a docs/decisions record, then add it to this list',
    ).toEqual(RUNTIME_DEPENDENCIES);
  });

  it('rule 8.1: npm test runs once and never watches', () => {
    expect(JSON.parse(read('package.json')).scripts.test).toBe('vitest run');
  });

  it('rule 10.1: shared handlers have no Deno or Supabase imports, and index.ts only wires deps', () => {
    const bad = shared().filter((f) => /\bDeno\./.test(read(f)) || /from '(npm:|jsr:|https?:|@supabase)/.test(read(f)));
    must('10.1', 'Deno or Supabase import in _shared/', bad);
    const entries = files('supabase/functions', /^index\.ts$/).filter((f) => !f.includes('_shared'));
    must(
      '10.1',
      'index.ts must call Deno.serve and a handler from _shared/',
      entries.filter((f) => !/Deno\.serve/.test(read(f)) || !/_shared\//.test(read(f))),
    );
  });

  it('rule 10.2: every method of a deps interface is used by its handler', () => {
    const bad = shared().flatMap((f) => {
      const text = read(f);
      return [...text.matchAll(/interface (\w+Deps) \{([\s\S]*?)\n\}/g)].flatMap(([, name, body]) =>
        [...body.matchAll(/^ {2}(\w+)[(?:]/gm)]
          .map((m) => m[1])
          .filter((key) => !new RegExp(`\\b${key}\\b`).test(text.replace(body, '')))
          .map((key) => `${name}.${key} in ${f}`),
      );
    });
    must('10.2', 'deps member never used', bad);
  });

  it('rule 10.3 and 10.4: each handler validates its input and has a test', () => {
    const handlers = shared().filter((f) => /export (async )?function handle\w+/.test(read(f)));
    expect(handlers.length).toBeGreaterThan(0);
    must(
      '10.3',
      'handler never answers a 4xx for a bad request',
      handlers.filter((f) => !/reply\(4\d\d/.test(read(f))),
    );
    must(
      '10.4',
      'handler without a sibling .test.ts',
      handlers.filter((f) => !existsSync(join(process.cwd(), f.replace(/\.ts$/, '.test.ts')))),
    );
  });

  it('rule 4.4: a migration with policies is run on PGlite as each role', () => {
    const tests = files('src', /Postgres\.test\.ts$/).map((f) => read(f));
    const bad = migrations()
      .filter(({ sql }) => /CREATE POLICY/i.test(sql))
      .map(({ f }) => f)
      .filter((f) => !tests.some((t) => t.includes(f.replace('supabase/', '')) && /SET ROLE/.test(t)));
    must('4.4', 'policy migration not exercised with SET ROLE in a *Postgres.test.ts', bad);
  });

  describe('rule 11.2: new migrations can run twice', () => {
    // TODO(#78): remove this exception list.
    const LEGACY = [
      '20260101000000_initial_schema.sql',
      '20261006120000_wallets.sql',
      '20261007000000_soft_remove.sql',
      '20261008000000_auth_rls.sql',
    ];
    const unsafe: [RegExp, string][] = [
      [/CREATE TABLE (?!IF NOT EXISTS)/i, 'CREATE TABLE without IF NOT EXISTS'],
      [/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/i, 'CREATE INDEX without IF NOT EXISTS'],
      [/ADD COLUMN (?!IF NOT EXISTS)/i, 'ADD COLUMN without IF NOT EXISTS'],
      [/CREATE FUNCTION/i, 'CREATE FUNCTION instead of CREATE OR REPLACE'],
    ];
    it('uses IF NOT EXISTS, OR REPLACE and DROP ... IF EXISTS', () => {
      const bad = migrations()
        .filter(({ f }) => !LEGACY.some((l) => f.endsWith(l)))
        .flatMap(({ f, sql }) => [
          ...unsafe.filter(([re]) => re.test(sql)).map(([, why]) => `${f}: ${why}`),
          ...[...sql.matchAll(/CREATE (POLICY|TRIGGER) ("[^"]+"|\w+) ON ([\w.]+)/gi)]
            .filter(([, kind, name, table]) => !new RegExp(`DROP ${kind} IF EXISTS ${name} ON ${table}`, 'i').test(sql))
            .map(([, kind, name]) => `${f}: CREATE ${kind} ${name} without a DROP ... IF EXISTS before it`),
        ]);
      must('11.2', 'migration is not safe to run twice', bad);
    });
  });
});
