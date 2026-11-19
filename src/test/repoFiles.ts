import { expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

export const read = (p: string) => readFileSync(join(root, p), 'utf8');

export const files = (dir: string, ext: RegExp): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(`${dir}/${e.name}`, ext) : ext.test(e.name) ? [`${dir}/${e.name}`] : [],
  );

export const isTest = (f: string) => /\.test\.tsx?$/.test(f) || f.startsWith('src/test/');

export const sourceFiles = () =>
  [...files('src', /\.tsx?$/), ...files('supabase/functions', /\.ts$/)].filter((f) => !isTest(f));

export const lineHits = (list: string[], test: (line: string, file: string) => boolean) =>
  list.flatMap((f) =>
    read(f)
      .split('\n')
      .flatMap((line, i) => (test(line, f) ? [`${f}:${i + 1}`] : [])),
  );

const FIX: Record<string, string> = {
  '1.6':
    'Put the code in an existing layer (docs/coding-standards.md section 1). A new folder needs a docs/decisions record first.',
  '2.4': 'Import the type from domain/ with `import type`; delete the copy.',
  '3.3': 'Write audit rows only through recordHistory in db/transactions.ts.',
  '3.5': 'Browser code uses the anon key only. Move service-role work into a supabase/functions edge function.',
  '4.4':
    'Add a test in a *Postgres.test.ts that runs this migration on PGlite and uses SET ROLE as each affected role.',
  '4.5': 'Remove it from client code; database triggers set authorship.',
  '4.6': 'Never write a PIN, password or secret to storage or a URL. Keep it in memory only.',
  '5.2': 'Render all three states: loading, failed with a retry (LoadFailed / refresh) and loaded.',
  '5.4': 'Call requireUnlocked() before the write, and ask the owner to confirm owner-only actions (useOwnerAction).',
  '8.1': 'vi.mock the Supabase client with src/test/fakeSupabase.ts; unit tests never reach a live database.',
  '9.4': 'Delete the comment, or cut it to one line that says why the code cannot.',
  '9.4/9.8': 'Delete the comment, or rewrite it to say why, not what changed.',
  '9.6': 'Pages and components use `export default`; anything else uses a named export.',
  '10.1':
    '_shared/ holds pure handleX(req, deps) with no Deno or Supabase imports; index.ts only builds deps and calls Deno.serve.',
  '10.2': 'Remove the unused member from the Deps interface, or use it in the handler.',
  '10.3': 'Validate each field of the request body at the top of the handler and reply with a 4xx and a short message.',
  '10.4': 'Add <handler>.test.ts next to it with fake deps covering every path.',
  '11.2':
    'Make the migration safe to run twice: IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS before CREATE POLICY or TRIGGER.',
};
const NO_WORKAROUND =
  'Fix the code, not the check: do not edit this test, its exception lists, or eslint.config.js, and do not add an eslint-disable.';

export const must = (rule: string, what: string, bad: string[]) => {
  if (!FIX[rule]) throw new Error(`standards test for rule ${rule} has no FIX text`);
  expect(bad, `rule ${rule}: ${what}: ${bad.join(', ')}\nFIX: ${FIX[rule]}\n${NO_WORKAROUND}`).toEqual([]);
};
