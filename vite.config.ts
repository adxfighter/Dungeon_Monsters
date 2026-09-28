import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (dir: string): string => fileURLToPath(new URL(`./src/${dir}`, import.meta.url));

// GitHub Pages serves the site from /Dungeon_Monsters/ (ADR-0003).
const PAGES_BASE = '/Dungeon_Monsters/';

export default defineConfig(({ command, isPreview }) => ({
  // dev server, Vitest and Playwright use '/'; `vite preview` serves the Pages build, so it needs the same base.
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  resolve: {
    // Keep in sync with tsconfig.json "paths".
    alias: {
      '@app': src('app'),
      '@core': src('core'),
      '@content': src('content'),
      '@render': src('render'),
      '@ui': src('ui'),
      '@platform': src('platform'),
      '@shared': src('shared'),
    },
  },
  // Preact automatic JSX runtime (no plugin needed with Vite's built-in Oxc transform).
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  build: {
    target: 'es2022',
    // three is one ~540 kB (136 kB gzip) chunk; the real budget (1 MB gzip) is checked in PR notes.
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
  },
}));
