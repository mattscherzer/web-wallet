// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { files, isTest, lineHits, read, sourceFiles, must } from './test/repoFiles';

const src = () => sourceFiles().filter((f) => f.startsWith('src/'));
const inLayer = (f: string, ...layers: string[]) => layers.some((l) => f.startsWith(`src/${l}/`));

// TODO(#78): remove this exception list.
const NAMED_UI = [
  'components/CashCountView',
  'components/FilledField',
  'components/LoadingSkeletons',
  'components/RecordFab',
  'pages/admin/StaffSheets',
].map((n) => `src/${n}.tsx`);

describe('coding standards: source code', () => {
  it('rule 1.6: src has only the layers in the architecture table', () => {
    const allowed = [
      'app',
      'pages',
      'components',
      'auth',
      'wallet',
      'hooks',
      'db',
      'platform',
      'domain',
      'utils',
      'assets',
      'devEnv',
      'styles',
      'test',
    ];
    const dirs = readdirSync(join(process.cwd(), 'src'), { withFileTypes: true }).filter((e) => e.isDirectory());
    must(
      '1.6',
      'folder outside the architecture table (add a decision record first)',
      dirs.map((d) => d.name).filter((n) => !allowed.includes(n)),
    );
  });

  it('rule 2.4: adapters and UI do not redeclare a domain type', () => {
    const domainTypes = files('src/domain', /\.ts$/)
      .filter((f) => !isTest(f))
      .flatMap((f) => [...read(f).matchAll(/^export (?:type|interface) (\w+)/gm)].map((m) => m[1]));
    const bad = src()
      .filter((f) => !inLayer(f, 'domain'))
      .flatMap((f) =>
        domainTypes
          .filter((t) => new RegExp(`^(?:export )?(?:type|interface) ${t}\\b`, 'm').test(read(f)))
          .map((t) => `${t} in ${f}`),
      );
    must('2.4', 'domain type declared again outside domain/', bad);
  });

  it('rule 2.6: CSV builders take their cells from csvCells', () => {
    const csv = files('src/domain', /\.ts$/).filter((f) => !isTest(f) && f !== 'src/domain/csvCells.ts');
    const bad = csv.filter(
      (f) => /replace\(\/"\/g/.test(read(f)) || (/Csv\.ts$/.test(f) && !read(f).includes("from './csvCells'")),
    );
    must('2.6', 'CSV quoting outside csvCells.ts, or a CSV builder that does not use it', bad);
  });

  it('rule 3.3: only db/transactions.ts writes to audit_log', () => {
    const bad = src().filter(
      (f) =>
        f !== 'src/db/transactions.ts' && /from\(\s*'audit_log'\s*\)\s*\.(insert|update|delete|upsert)/.test(read(f)),
    );
    must('3.3', 'audit_log write outside recordHistory', bad);
  });

  it('rule 3.5: the service-role key never reaches the browser', () => {
    const bad = [...src(), 'index.html', '.env.example'].filter((f) => /service[_-]?role/i.test(read(f)));
    must('3.5', 'service-role key mentioned in browser code or env example', bad);
  });

  it('rule 4.5: the client never sets authorship columns', () => {
    const bad = lineHits(
      src().filter((f) => !inLayer(f, 'domain')),
      (l) => /\bcreated_by(_role|_name)?\b/.test(l),
    );
    must('4.5', 'created_by* in client code (database triggers set it)', bad);
  });

  it('rule 4.6: no secret is put in storage', () => {
    const bad = lineHits(src(), (l) =>
      /(setItem|writeCurrentWalletId)\(\s*['"`]?[\w.]*(pin|password|token|secret)/i.test(l),
    );
    must('4.6', 'secret written to storage', bad);
  });

  it('rule 5.2: a file that reads wallet data handles loaded and failed', () => {
    const queryHooks = files('src/hooks', /\.ts$/)
      .filter((f) => !isTest(f) && /useWalletQuery\b/.test(read(f)))
      .flatMap((f) => [...read(f).matchAll(/export function (use\w+)/g)].map((m) => m[1]))
      .filter((n) => n !== 'useWalletQuery' && !n.startsWith('useLoaded'));
    const bad = src()
      .filter((f) => inLayer(f, 'pages', 'components'))
      .filter((f) => queryHooks.some((h) => new RegExp(`\\b${h}\\(`).test(read(f))))
      .filter(
        (f) =>
          !/\b(failed|LoadFailed|status === 'error')/.test(read(f)) ||
          !/\b(loaded|PageLoading|status === 'loading')/.test(read(f)),
      );
    must('5.2', 'reads data without handling loaded and failed', bad);
  });

  it('rule 5.4: a page that writes checks the view-only lock or asks the owner to confirm', () => {
    const bad = src()
      .filter((f) => inLayer(f, 'pages', 'components'))
      .filter(
        (f) =>
          /\b(useTransactionCommands|useStaffAdmin)\(/.test(read(f)) &&
          !/requireUnlocked|useOwnerAction|admin\/StaffSheets/.test(read(f)),
      );
    must('5.4', 'writes without requireUnlocked() or an owner confirmation', bad);
  });

  it('rule 6.1: TypeScript strict mode stays on', () => {
    for (const config of ['tsconfig.app.json', 'tsconfig.node.json'])
      expect(read(config), config).toMatch(/"strict":\s*true/);
  });

  it('rule 9.4 and 9.8: comments do not narrate a change', () => {
    const narration =
      /\b(now uses|now returns|moved (from|to|into)|no longer|used to be|previously|was changed|refactored|changed to|for now)\b/i;
    const bad = lineHits(sourceFiles(), (l) => /^\s*(\/\/|\/\*|\*)/.test(l) && narration.test(l));
    must('9.4/9.8', 'comment narrates a change instead of saying why', bad);
  });

  it('rule 9.4: a comment is one line, not a paragraph', () => {
    const bad = sourceFiles().flatMap((f) => {
      const lines = read(f).split('\n');
      return lines.flatMap((l, i) =>
        /^\s*\/\/ /.test(l) &&
        /^\s*\/\/ /.test(lines[i + 1] ?? '') &&
        /^\s*\/\/ /.test(lines[i + 2] ?? '') &&
        !/^\s*\/\/ /.test(lines[i - 1] ?? '')
          ? [`${f}:${i + 1}`]
          : [],
      );
    });
    must('9.4', 'comment runs over three lines; say it in one', bad);
  });

  it('rule 9.6: pages have a default export; components too, except the listed ones', () => {
    const ui = files('src/pages', /\.tsx$/)
      .concat(files('src/components', /\.tsx$/))
      .filter((f) => !isTest(f));
    const bad = ui.filter((f) => !NAMED_UI.includes(f) && !/^export default /m.test(read(f)));
    must('9.6', 'page or component without a default export', bad);
  });

  it('rule 8.1: a test that imports the Supabase client mocks it', () => {
    const bad = files('src', /\.test\.tsx?$/).filter(
      (f) => /from '@supabase\/supabase-js'/.test(read(f)) && !/vi\.mock\('@supabase\/supabase-js'/.test(read(f)),
    );
    must('8.1', 'test uses the real Supabase client', bad);
  });

  it('rule 8.4: a test name says what it checks, not only an id', () => {
    const bad = files('src', /\.test\.tsx?$/)
      .concat(files('supabase', /\.test\.ts$/))
      .filter((f) => /\b(it|test)\(\s*['"`]T?\d+[a-z]?['"`]/.test(read(f)));
    must('8.4', 'test named only by an id', bad);
  });

  it('rule 12.5: size limits only go down', () => {
    const config = read('eslint.config.js');
    const limit = (re: RegExp) => Number(config.match(re)?.[1]);
    expect(limit(/'max-lines': \['error', \{ max: (\d+)/)).toBeLessThanOrEqual(300);
    expect(limit(/complexity: \['error', (\d+)/)).toBeLessThanOrEqual(15);
    expect(limit(/'max-depth': \['error', (\d+)/)).toBeLessThanOrEqual(3);
    expect(limit(/'max-params': \['error', (\d+)/)).toBeLessThanOrEqual(4);
  });
});
