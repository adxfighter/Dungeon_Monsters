import { expect, test } from '@playwright/test';

/**
 * `npm run screenshot`: PNGs of key screens at 390×844 → test-results/screens/.
 * Add a line per new screen as milestones introduce them.
 */
const SCREENS: { name: string; path: string; waitMs?: number }[] = [
  { name: 'arena', path: '/', waitMs: 4000 },
  { name: 'arena-debug', path: '/?debug=1', waitMs: 4000 },
  { name: 'room', path: '/?room=test_room' },
  { name: 'demo', path: '/?demo=1' },
];

for (const screen of SCREENS) {
  test(`screenshot: ${screen.name}`, async ({ page }) => {
    await page.goto(screen.path);
    await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
    // Let the overlay refresh and the scene settle for a few frames.
    await page.waitForTimeout(screen.waitMs ?? 600);
    await page.screenshot({ path: `test-results/screens/${screen.name}.png` });
  });
}
