import { expect, test, type CDPSession, type Page } from '@playwright/test';

/** Combat e2e (M2): buttons, damage, defeat screen. Arena is the default scene; spawn: (6.5, 5.5). */

async function tapElement(cdp: CDPSession, page: Page, testId: string): Promise<void> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} not visible`);
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.beforeEach(async ({ page }) => {
  // Low render resolution: SwiftShader frames are slow, and slow frames delay input events.
  await page.goto('/?pr=0.5');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
});

test('HUD shows hero HP, wave counter and Russian action buttons', async ({ page }) => {
  await expect(page.getByTestId('hero-hp')).toContainText('100 / 100');
  await expect(page.getByTestId('wave')).toContainText(/Волна \d\/3/, { timeout: 5000 });
  await expect(page.getByTestId('btn-attack')).toHaveText('Удар');
  await expect(page.getByTestId('btn-dodge')).toHaveText('Рывок');
  const attack = await page.getByTestId('btn-attack').boundingBox();
  expect(attack?.width).toBeGreaterThanOrEqual(64); // ≥ 64 dp touch target
});

test('the attack button damages a monster in front of the hero', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => window.__debug?.spawnMonster('bubbler', 6.5, 6.2));
  const hpOf = () =>
    page.evaluate(() => window.__debug?.getMonsters().find((m) => Math.abs(m.y - 6.2) < 1)?.hp ?? -1);
  const before = await hpOf();
  for (let i = 0; i < 3; i++) {
    await tapElement(cdp, page, 'btn-attack');
    await page.waitForTimeout(250);
  }
  await expect.poll(hpOf, { timeout: 3000 }).toBeLessThan(before);
  // Pressing the button must not also send a move tap under it.
  const target = await page.evaluate(() => window.__debug?.getMoveTarget());
  expect(target?.active).toBe(false);
});

test('losing all HP shows the defeat screen, and "again" restarts', async ({ page }) => {
  await page.evaluate(() => {
    window.__debug?.setHeroHp(1);
    window.__debug?.spawnMonster('stonenibbler', 6.5, 6.3);
  });
  const screen = page.getByTestId('end-screen');
  await expect(screen).toBeVisible({ timeout: 10_000 });
  await expect(screen).toContainText('Вас вынесли');
  await screen.getByRole('button').click();
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  await expect(page.getByTestId('hero-hp')).toContainText('100 / 100');
});
