import { expect, test, type Page } from '@playwright/test';

/** Collects console errors and uncaught exceptions for the whole test. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test('boots, renders with WebGL2 and logs no errors', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });

  const canvas = page.locator('canvas#game');
  await expect(canvas).toBeVisible();
  const hasWebgl2 = await canvas.evaluate((el: HTMLCanvasElement) => el.getContext('webgl2') !== null);
  expect(hasWebgl2).toBe(true);

  const box = await canvas.boundingBox();
  expect(box?.width).toBe(390);
  expect(box?.height).toBe(844);
  await expect(canvas).toHaveCSS('touch-action', 'none');

  expect(errors).toEqual([]);
});

test('debug overlay shows FPS and draw calls with ?debug=1&pr=1', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?debug=1&pr=1');
  const overlay = page.getByTestId('debug-overlay');
  await expect(overlay).toContainText('FPS', { timeout: 20_000 });
  await expect(overlay).toContainText(/calls\s+\d+/);
  await expect(overlay).toContainText(/pr\s+1\.00/);
  expect(errors).toEqual([]);
});

test('no debug overlay by default', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  await expect(page.getByTestId('debug-overlay')).toHaveCount(0);
});
