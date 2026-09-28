// @ts-check
import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Layers from docs/ARCHITECTURE.md §3. */
const LAYERS = ['app', 'core', 'content', 'render', 'ui', 'platform', 'shared'];

/** Which layers each layer may import (ARCHITECTURE §3). */
const ALLOWED = {
  app: LAYERS,
  core: ['core', 'content', 'shared'],
  content: ['content', 'shared'],
  render: ['render', 'core', 'content', 'shared', 'platform'],
  ui: ['ui', 'core', 'content', 'shared', 'platform'],
  platform: ['platform', 'shared'],
  shared: ['shared'],
};

/** External packages restricted to specific layers (ARCHITECTURE §3, `boundaries/external`). */
const RESTRICTED_PACKAGES = {
  three: ['render', 'app'],
  preact: ['ui', 'app'],
  zod: ['content'],
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ['*.config.{js,ts}', 'tools/**', 'tests/**'],
    languageOptions: { globals: { ...globals.node } },
  },

  // --- Layer boundaries ---
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
      'boundaries/elements': LAYERS.map((type) => ({ type, pattern: `src/${type}` })),
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          checkUnknownLocals: true,
          policies: [
            ...LAYERS.map((type) => ({
              from: { element: { type } },
              allow: { to: { element: { types: { anyOf: ALLOWED[type] } } } },
            })),
            // External packages are allowed unless restricted below.
            { allow: { to: { module: { origin: 'external' } } } },
            // Node built-ins (node:*) are never allowed in game code.
            { disallow: { to: { module: { origin: 'core' } } } },
            ...Object.entries(RESTRICTED_PACKAGES).map(([pkg, layers]) => ({
              // micromatch does not expand a one-item brace list, so '!{content}' would match nothing.
              from: { element: { type: layers.length === 1 ? `!${layers[0]}` : `!{${layers.join(',')}}` } },
              disallow: { to: { module: { origin: 'external', source: [pkg, `${pkg}/**`] } } },
            })),
          ],
        },
      ],
    },
  },

  // --- Pure core: determinism and no platform access ---
  {
    files: ['src/core/**/*.{ts,tsx}', 'src/content/**/*.{ts,tsx}', 'src/shared/**/*.{ts,tsx}'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'globalThis',
          'self',
          'localStorage',
          'performance',
          'process',
        ].map((name) => ({
          name,
          message: 'core/content/shared must stay platform-free (ARCHITECTURE §3).',
        })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use core/rng (seedable) instead of Math.random.' },
        { object: 'Date', property: 'now', message: 'Use core/clock instead of Date.now.' },
        { object: 'performance', property: 'now', message: 'Use core/clock instead of performance.now.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*'],
              message: 'core/content/shared must not depend on three (render only).',
            },
            {
              group: ['preact', 'preact/*'],
              message: 'core/content/shared must not depend on preact (ui only).',
            },
            { group: ['@render/*', '@ui/*', '@app/*', '@platform/*'], message: 'Layer violation.' },
          ],
        },
      ],
    },
  },

  // --- Browser layers: Node globals type-check (tsconfig includes node types for tooling) but crash at runtime ---
  {
    files: [
      'src/app/**/*.{ts,tsx}',
      'src/render/**/*.{ts,tsx}',
      'src/ui/**/*.{ts,tsx}',
      'src/platform/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['process', 'Buffer', 'require', '__dirname'].map((name) => ({
          name,
          message: 'Node globals are not available in the browser; use import.meta.env.',
        })),
      ],
    },
  },

  prettier,
);
