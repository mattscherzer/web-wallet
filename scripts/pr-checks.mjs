// Pull-request rules that need the diff or the PR text. Run in CI: node scripts/pr-checks.mjs
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const TITLE = /^(feat|fix|refactor|perf|test|docs|style|build|ci|chore)(\([a-z0-9-]+\))?!?: .+/;
export const ENFORCERS =
  /^(eslint\.config\.js|scripts\/|src\/standards[^/]*\.test\.ts|src\/test\/repoFiles\.ts|\.github\/(workflows\/|pull_request_template\.md|CODEOWNERS)|\.claude\/(settings\.json|hooks\/))/;
const UI_FILE = /^src\/(pages|components|styles)\/.*(?<!\.test)\.(tsx|css)$|^src\/index\.css$/;
const EVIDENCE = /!\[[^\]]*\]\(\S+\)|<img\s|<video\s|user-attachments\/assets\/|\.(mp4|mov|webm)\b/i;
const DATA_CHANGE =
  /\b(update\s+\S+\s+set|delete\s+from|drop\s+(column|table)|truncate|alter\s+column\s+\S+\s+(set\s+data\s+)?type)\b/i;
const LIMITS = {
  'max-lines': /'max-lines': \['error', \{ max: (\d+)/,
  complexity: /complexity: \['error', (\d+)/,
  'max-depth': /'max-depth': \['error', (\d+)/,
  'max-params': /'max-params': \['error', (\d+)/,
};

export const limitsOf = (config) =>
  Object.fromEntries(Object.entries(LIMITS).map(([k, re]) => [k, Number(config.match(re)?.[1] ?? Infinity)]));

const sectionBody = (body, name) =>
  body
    .match(new RegExp(`^## ${name}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'im'))?.[1]
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim() ?? '';

/** Returns the list of broken rules; empty means the PR passes. */
export function checkPr({
  title,
  body,
  changed,
  sql = {},
  assertions = [],
  limits,
  baseLimits,
  newDeps = [],
  newFolders = [],
  disablesAdded = 0,
}) {
  const out = [];
  if (!TITLE.test(title)) out.push(`12.1: title must look like 'type(scope): summary', got: ${title}`);
  for (const s of ['What', 'Why', 'How it was checked'])
    if (!sectionBody(body, s)) out.push(`12.3: PR description has an empty "${s}" section`);
  const files = changed.map((c) => c.path);
  const touched = (c) => c.path.startsWith('supabase/migrations/');
  for (const c of changed.filter(touched))
    if (/^[MDR]/.test(c.status)) out.push(`11.1: applied migration edited, deleted or renamed: ${c.path}`);
  for (const c of changed.filter((x) => touched(x) && x.status === 'A'))
    if (DATA_CHANGE.test(sql[c.path] ?? '') && !/backup/i.test(body))
      out.push(`11.4: ${c.path} changes data; the PR must say a backup is needed before production`);
  if (/^fix(\(|!|:)/.test(title) && !files.some((f) => /\.test\.tsx?$/.test(f)))
    out.push('8.6: a fix PR must change a test');
  for (const a of assertions)
    if (a.after < a.before && !/^Assertions removed:\s*\S+/im.test(body))
      out.push(
        `8.5: ${a.path} lost ${a.before - a.after} expect() call(s); explain with an "Assertions removed: <why>" line in the PR`,
      );
  if (files.some((f) => UI_FILE.test(f)) && !EVIDENCE.test(sectionBody(body, 'UI evidence')))
    out.push(
      '12.6: the PR changes the UI; add screenshots or a video of the result under "## UI evidence" (gh pr edit --attach)',
    );
  const raised = Object.keys(limits).filter((k) => limits[k] > baseLimits[k]);
  for (const k of raised) out.push(`12.5: lint limit ${k} raised from ${baseLimits[k]} to ${limits[k]}`);
  const needsRecord = [
    ...raised.map((k) => `raised ${k}`),
    ...newDeps.map((d) => `new dependency ${d}`),
    ...newFolders.map((f) => `new folder ${f}`),
  ];
  if (needsRecord.length && !changed.some((c) => c.status === 'A' && c.path.startsWith('docs/decisions/')))
    out.push(`12.4: ${needsRecord.join(', ')} needs a new record in docs/decisions/`);
  const enforcers = files.filter((f) => ENFORCERS.test(f));
  if (enforcers.length && !/^Standards change:\s*\S+/im.test(body))
    out.push(
      `14.1: the PR changes the rules' own enforcement (${enforcers.join(', ')}). A person must review it: add a "Standards change: <what and why>" line`,
    );
  if (disablesAdded && !/^Disables added:\s*\S+/im.test(body))
    out.push(
      `5.7: ${disablesAdded} eslint-disable line(s) added. Fix the cause instead, or justify each with a "Disables added: <why>" line`,
    );
  return out;
}

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' });
const count = (text) => (text.match(/\bexpect(\.\w+)?\(/g) ?? []).length;
const show = (ref, path) => {
  try {
    return git('show', `${ref}:${path}`);
  } catch {
    return '';
  }
};

function main() {
  const base = process.env.BASE_SHA ?? 'origin/main';
  const changed = git('diff', '--name-status', '-M', `${base}...HEAD`)
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [status, ...p] = l.split('\t');
      return { status, path: p.at(-1) };
    });
  const sql = Object.fromEntries(
    changed.filter((c) => c.status === 'A' && c.path.endsWith('.sql')).map((c) => [c.path, show('HEAD', c.path)]),
  );
  const assertions = changed
    .filter((c) => /\.test\.tsx?$/.test(c.path) && c.status === 'M')
    .map((c) => ({ path: c.path, before: count(show(base, c.path)), after: count(show('HEAD', c.path)) }));
  const deps = (ref) => Object.keys(JSON.parse(show(ref, 'package.json') || '{}').dependencies ?? {});
  const folders = (ref) => git('ls-tree', '-d', '--name-only', ref, 'src/').split('\n').filter(Boolean);
  const disablesAdded = git('diff', '-U0', `${base}...HEAD`, '--', 'src', 'supabase/functions')
    .split('\n')
    .filter((l) => /^\+(?!\+\+).*eslint-disable/.test(l)).length;
  const problems = checkPr({
    disablesAdded,
    title: process.env.PR_TITLE ?? '',
    body: process.env.PR_BODY ?? '',
    changed,
    sql,
    assertions,
    limits: limitsOf(show('HEAD', 'eslint.config.js')),
    baseLimits: limitsOf(show(base, 'eslint.config.js')),
    newDeps: deps('HEAD').filter((d) => !deps(base).includes(d)),
    newFolders: folders('HEAD').filter((f) => !folders(base).includes(f)),
  });
  problems.forEach((p) => console.error(`rule ${p}`));
  process.exit(problems.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
