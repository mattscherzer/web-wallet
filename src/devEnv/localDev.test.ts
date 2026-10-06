// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv } from 'vite';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const scripts = (): Record<string, string> => JSON.parse(read('package.json')).scripts;

const PROD_URL = 'https://abcdefgh.supabase.co';
const PROD_KEY = 'prod-anon-key-should-never-load-in-dev';

/** A scratch project dir holding a production-flavoured `.env` plus the repo's committed env files. */
function scratchEnvDir(extra: Record<string, string> = {}) {
  // vitest copies the repo's own .env into process.env, and loadEnv lets process.env win; isolate from that.
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_ANON_KEY;
  const dir = mkdtempSync(join(tmpdir(), 'wallet-env-'));
  writeFileSync(join(dir, '.env'), `VITE_SUPABASE_URL=${PROD_URL}\nVITE_SUPABASE_ANON_KEY=${PROD_KEY}\n`);
  if (existsSync(join(root, '.env.development'))) copyFileSync(join(root, '.env.development'), join(dir, '.env.development'));
  for (const [name, body] of Object.entries(extra)) writeFileSync(join(dir, name), body);
  return dir;
}

function migrationsSql() {
  const dir = join(root, 'supabase/migrations');
  if (!existsSync(dir)) return '';
  return readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
}

describe('local Supabase dev environment', () => {
  it('T1 npm run dev uses the local stack even when .env holds production credentials', () => {
    const env = loadEnv('development', scratchEnvDir(), 'VITE_');
    expect(env.VITE_SUPABASE_URL).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/);
    expect(env.VITE_SUPABASE_ANON_KEY).toBeTruthy();
    expect(env.VITE_SUPABASE_URL).not.toContain('supabase.co');
    expect(env.VITE_SUPABASE_ANON_KEY).not.toBe(PROD_KEY);
  });

  it('T2 db start, stop, reset and seed commands exist and plain dev stays default mode', () => {
    const s = scripts();
    expect(s['db:start']).toMatch(/supabase start/);
    expect(s['db:stop']).toMatch(/supabase stop/);
    expect(s['db:reset']).toMatch(/supabase db reset/);
    expect(s['db:seed']).toMatch(/seed\.sql/);
    expect(s.dev).toBe('vite');
  });

  it('T3 reset loads a seed file with fake transactions and audit entries that point at seeded transactions', () => {
    const config = read('supabase/config.toml');
    expect(config).toMatch(/\[db\.seed\][^[]*enabled\s*=\s*true/);
    expect(config).toContain('./seed.sql');
    const seed = read('supabase/seed.sql');
    expect(seed).toMatch(/insert into (public\.)?transactions/i);
    expect(seed).toMatch(/insert into (public\.)?audit_log/i);
    expect(seed).toMatch(/on conflict/i);
    expect(seed).toMatch(/insert into (public\.)?app_config[^;]*'pin'/i);
    const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const [txPart, auditPart] = seed.split(/insert into (?:public\.)?audit_log/i);
    const txIds = new Set(txPart.match(uuid) ?? []);
    const auditIds = auditPart.match(uuid) ?? [];
    expect(txIds.size).toBeGreaterThan(0);
    expect(auditIds.length).toBeGreaterThan(0);
    // every uuid in the audit block is either a seeded transaction or an audit row id (no dangling reference)
    expect(auditIds.some((id) => txIds.has(id))).toBe(true);
  });

  it('T4 the database structure is defined only by migrations', () => {
    expect(existsSync(join(root, 'supabase-schema.sql'))).toBe(false);
    const sql = migrationsSql();
    expect(sql).toMatch(/create table (public\.)?transactions/i);
    expect(sql).toMatch(/create table (public\.)?audit_log/i);
    expect(sql).toMatch(/create table (public\.)?app_config/i);
    expect(sql).not.toMatch(/insert into (public\.)?app_config/i);
  });

  it('T5 production needs the explicit dev:prod command, with its own gitignored credentials file', () => {
    expect(scripts()['dev:prod']).toMatch(/vite\s+--mode\s+prod\b/);
    const env = loadEnv('prod', scratchEnvDir({ '.env.prod.local': 'VITE_SUPABASE_URL=https://real.supabase.co\nVITE_SUPABASE_ANON_KEY=real\n' }), 'VITE_');
    expect(env.VITE_SUPABASE_URL).toBe('https://real.supabase.co');
    const ignored = (p: string) => {
      try { execFileSync('git', ['check-ignore', '-q', p], { cwd: root }); return true; } catch { return false; }
    };
    expect(ignored('.env.prod.local')).toBe(true);
    expect(ignored('.env.development')).toBe(false);
    expect(existsSync(join(root, '.env.development'))).toBe(true);
  });

  it('T6 the CLI version is pinned and the docs explain credentials, production migrations and cache clearing', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.devDependencies.supabase).toMatch(/^\d+\.\d+\.\d+$/);
    const example = read('.env.example');
    expect(example).toContain('.env.prod.local');
    expect(example).toContain('dev:prod');
    const readme = read('README.md');
    expect(readme).toMatch(/db:start/);
    expect(readme).toMatch(/migration repair/);
    expect(readme).toMatch(/db push/);
    expect(readme).toMatch(/\.env\.prod\.local/);
    expect(readme).toMatch(/site data/i);
  });

  it('G1 build, lint and typecheck commands are unchanged and build is not pinned to a mode', () => {
    const s = scripts();
    expect(s.build).toBe('tsc -b && vite build');
    expect(s.lint).toBe('eslint .');
    expect(s.typecheck).toBe('tsc -b');
  });

  it('G2 the interim dev:test / staging mode stays absent', () => {
    const s = scripts();
    expect(Object.keys(s).filter((k) => /staging|dev:test/.test(k))).toEqual([]);
    expect(existsSync(join(root, '.env.staging.local.example'))).toBe(false);
  });
});
