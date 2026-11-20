import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

// Anchored to ../ up to three levels so ../domain/wallet is not mistaken for the wallet layer.
const rel = (...layers) =>
  layers.flatMap((l) => ['../', '../../', '../../../'].flatMap((up) => [`${up}${l}`, `${up}${l}/**`]));
const ui = ['react', 'react-dom', 'react-dom/*', 'react-router', 'react-router/*', 'lucide-react'];

// Type-only imports stay allowed everywhere.
const restrict = (files, message, ...groups) => ({
  files,
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      { patterns: groups.map((group) => ({ group, message, allowTypeImports: true })) },
    ],
  },
});

const tests = ['**/*.test.{ts,tsx}', 'src/test/**'];
const source = ['src/**/*.{ts,tsx}', 'supabase/functions/**/*.ts'];

// A later no-restricted-syntax block replaces an earlier one, so every block spreads from these.
const syntax = (selector, message) => ({
  selector,
  message: `${message} Fix the code; do not add an eslint-disable or loosen this rule.`,
});
const noEnums = syntax(
  'TSEnumDeclaration',
  'Use a union of string literals or an `as const` object, not an enum (13.13).',
);
const skippedTests = [
  syntax(
    'MemberExpression[object.name=/^(it|test|describe)$/][property.name=/^(skip|only|todo|fails)$/]',
    'Skipped, focused or todo tests hide failures (8.5). Fix the test or delete it.',
  ),
  syntax('CallExpression[callee.name=/^(xit|xtest|xdescribe|fit|fdescribe)$/]', 'Skipped or focused test (8.5).'),
  syntax(
    'CallExpression[callee.name="expect"][arguments.0.value=true]',
    'An assertion that cannot fail proves nothing (8.5).',
  ),
  syntax(
    'CallExpression[callee.name=/^(it|test)$/] > Literal:first-child[value=/^test\\b/i]',
    'Name tests by behaviour, not "test <function>" (8.4).',
  ),
];
const noSwallowing = [
  syntax(
    'CallExpression[callee.property.name="catch"] > ArrowFunctionExpression[body.type="BlockStatement"][body.body.length=0]',
    'An empty .catch swallows the error (7.4).',
  ),
  syntax(
    'CallExpression[callee.property.name="catch"] > ArrowFunctionExpression[body.type="Identifier"][body.name="undefined"]',
    '.catch(() => undefined) swallows the error (7.4).',
  ),
];
const noClasses = syntax(
  'ClassDeclaration:not([superClass.name=/Error$/])',
  'Compose from functions, hooks and components; no class hierarchies (13.3).',
);
const noSecretsInLogs = syntax(
  'CallExpression[callee.object.name="console"] Identifier[name=/^(pin|password|secret|token|apiKey)$/i]',
  'Secrets, PINs and passwords are never logged (4.6).',
);
const noUnguardedEffects = syntax(
  'CallExpression[callee.name="useEffect"]:has(:matches(AwaitExpression, CallExpression[callee.property.name="then"])):not(:has(Identifier[name=/^(live|cancelled|canceled|ignore|stale|alive)$/]))',
  'Async work in an effect needs a `live` flag so a late result cannot overwrite newer state (5.3).',
);
const noClock = [
  syntax(
    'NewExpression[callee.name="Date"][arguments.length=0]',
    'Domain does not read the clock; pass `now` in (2.1).',
  ),
  syntax(
    'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
    'Domain does not read the clock; pass `now` in (2.1).',
  ),
];
const noDateParsing = syntax(
  'NewExpression[callee.name="Date"][arguments.length=1]:not([arguments.0.type="Literal"]):not([arguments.0.callee.object.name="Date"]), CallExpression[callee.object.name="Date"][callee.property.name="parse"]',
  'Domain does not parse date strings: timezone and two-digit years bite. Compare "YYYY-MM-DD" strings, or build with Date.UTC (2.5).',
);
const noClickableDivs = syntax(
  'JSXOpeningElement[name.name=/^(div|span|li|p|section)$/]:has(JSXAttribute[name.name="onClick"])',
  'Interactive elements are real buttons, links or inputs (5.6).',
);
const noPinRulesInUI = syntax(
  'BinaryExpression:has(> Identifier[name="PIN_LENGTH"]):has(> MemberExpression[property.name="length"])',
  'PIN length rules live in domain/pin (isPinComplete, appendPinDigit); do not compare a length to PIN_LENGTH here (1.5).',
);
const noEffectsInUI = syntax(
  'CallExpression[callee.name=/^(useEffect|useLayoutEffect)$/], CallExpression[callee.property.name=/^(useEffect|useLayoutEffect)$/]',
  'Pages and components hold no effects. Move it into a hook in hooks/ named for what it does (5.8).',
);
const noDefaultExport = syntax('ExportDefaultDeclaration', 'Only pages and components use a default export (9.6).');
const everywhere = [noEnums, ...skippedTests, ...noSwallowing, noClasses, noSecretsInLogs, noUnguardedEffects];

export default defineConfig([
  globalIgnores(['dist']),
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  restrict(
    ['src/domain/**', 'src/utils/**'],
    'domain is pure: no React, Supabase or browser APIs, and no upper layers',
    [...ui, '@supabase/*', ...rel('db', 'platform', 'auth', 'wallet', 'hooks', 'components', 'pages', 'app')],
  ),
  {
    files: ['src/domain/**', 'src/utils/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'localStorage'].map((name) => ({
          name,
          message: 'domain is pure: no React, Supabase or browser APIs',
        })),
      ],
    },
  },
  restrict(['src/db/**', 'src/platform/**'], 'db and platform are adapters: no React and no upper layers', [
    ...ui,
    ...rel('auth', 'wallet', 'hooks', 'components', 'pages', 'app'),
  ]),
  restrict(
    ['src/auth/**', 'src/wallet/**', 'src/hooks/**'],
    'state layer sits below pages and app',
    rel('pages', 'app'),
  ),
  restrict(
    ['src/components/**', 'src/pages/**'],
    'UI goes through hooks and context, never db, platform or app directly',
    rel('db', 'platform', 'app'),
  ),
  {
    files: source,
    rules: {
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-alert': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 15],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'no-param-reassign': ['error', { props: true }],
      'no-else-return': 'error',
      'no-lonely-if': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-return': 'error',
      'object-shorthand': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': ['error', ...everywhere],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false },
      ],
    },
  },
  {
    files: ['src/{app,auth,wallet,hooks,db,platform,utils}/**'],
    rules: { 'no-restricted-syntax': ['error', ...everywhere, noDefaultExport, noPinRulesInUI] },
  },
  {
    files: ['src/domain/**'],
    rules: { 'no-restricted-syntax': ['error', ...everywhere, noDefaultExport, ...noClock, noDateParsing] },
  },
  {
    files: ['src/components/**', 'src/pages/**'],
    rules: { 'no-restricted-syntax': ['error', ...everywhere, noClickableDivs, noEffectsInUI, noPinRulesInUI] },
  },
  {
    files: ['src/{app,auth,wallet,hooks,platform,domain,utils,pages}/**'],
    rules: { '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }] },
  },
  {
    files: tests,
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
      'no-restricted-globals': 'off',
      'max-lines': 'off',
      complexity: 'off',
      'max-depth': 'off',
      'max-params': 'off',
      'no-param-reassign': 'off',
      'no-console': 'off',
      'no-restricted-syntax': ['error', noEnums, ...skippedTests],
      'no-alert': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
    },
  },
]);
