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

export default defineConfig([
  globalIgnores(['dist']),
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
    files: tests,
    rules: { '@typescript-eslint/no-restricted-imports': 'off', 'no-restricted-globals': 'off' },
  },
]);
