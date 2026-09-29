import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const isCI = !!process.env['CI'];

/** Target phone viewport (docs/ARCHITECTURE.md §11). */
const mobile = {
  ...devices['Pixel 7'],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  // Russian is the primary language (CLAUDE.md §1): screenshots and text checks use it.
  locale: 'ru-RU',
  launchOptions: {
    // Headless CI has no GPU: render WebGL2 through SwiftShader.
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  },
};

export default defineConfig({
  // test-results/ is shared with screenshots (test-results/screens/), so Playwright's own output goes deeper.
  outputDir: 'test-results/artifacts',
  // Software WebGL (SwiftShader) saturates the CPU; parallel pages starve each other and time out.
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', testDir: 'tests/e2e', use: mobile },
    { name: 'screenshot', testDir: 'tests/screens', use: mobile },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
