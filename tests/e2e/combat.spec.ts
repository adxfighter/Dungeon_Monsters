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
  await expect(page.getByTestId('wave')).toContainText(/Волна \d\/4/, { timeout: 5000 });
  await expect(page.getByTestId('btn-attack')).toHaveText('Удар');
  await expect(page.getByTestId('btn-dodge')).toHaveText('Рывок');
  const attack = await page.getByTestId('btn-attack').boundingBox();
  expect(attack?.width).toBeGreaterThanOrEqual(64); // ≥ 64 dp touch target
  const gear = await page.getByTestId('btn-settings').boundingBox();
  expect(gear?.width).toBeGreaterThanOrEqual(48); // ≥ 48 dp
  expect(gear?.height).toBeGreaterThanOrEqual(48);
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

test('enemies show HP bars and hits pop damage numbers', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => window.__debug?.spawnMonster('bubbler', 6.5, 6.2));
  await expect(page.getByTestId('enemy-hp').first()).toBeVisible({ timeout: 5000 });
  // Numbers live < 1 s: record every one that becomes visible instead of racing to catch it.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __seenNumbers: string[] }).__seenNumbers = seen;
    new MutationObserver(() => {
      for (const el of document.querySelectorAll<HTMLElement>('[data-testid="damage-number"]')) {
        if (el.style.display !== 'none' && el.textContent) seen.push(el.textContent);
      }
    }).observe(document.body, { subtree: true, attributes: true, childList: true, characterData: true });
  });
  for (let i = 0; i < 3; i++) {
    await tapElement(cdp, page, 'btn-attack');
    await page.waitForTimeout(200);
  }
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __seenNumbers: string[] }).__seenNumbers), {
      timeout: 3000,
    })
    .toContainEqual(expect.stringMatching(/^\d+$/));
});

test('settings toggle shake and vibration and persist across reloads', async ({ page }) => {
  await page.getByTestId('btn-settings').click();
  const panel = page.getByTestId('settings');
  await expect(panel).toContainText('Тряска камеры');
  const shake = panel.getByRole('checkbox').first();
  await expect(shake).toBeChecked();
  await shake.click();
  await expect(shake).not.toBeChecked();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  await page.getByTestId('btn-settings').click();
  await expect(page.getByTestId('settings').getByRole('checkbox').first()).not.toBeChecked();
});

test('action buttons: left by default, dodge above attack, side switch persists', async ({ page }) => {
  const attack = await page.getByTestId('btn-attack').boundingBox();
  const dodge = await page.getByTestId('btn-dodge').boundingBox();
  if (!attack || !dodge) throw new Error('buttons not visible');
  const vw = page.viewportSize()?.width ?? 390;
  expect(attack.x + attack.width / 2).toBeLessThan(vw / 2); // left side
  expect(dodge.y + dodge.height).toBeLessThanOrEqual(attack.y); // dodge stacked above
  expect(attack.width).toBeGreaterThan(dodge.width);

  await page.getByTestId('btn-settings').click();
  await page.getByTestId('side-right').click();
  const moved = await page.getByTestId('btn-attack').boundingBox();
  expect((moved?.x ?? 0) + (moved?.width ?? 0) / 2).toBeGreaterThan(vw / 2);
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  const after = await page.getByTestId('btn-attack').boundingBox();
  expect((after?.x ?? 0) + (after?.width ?? 0) / 2).toBeGreaterThan(vw / 2);
});

test('the vibration test explains the result', async ({ page }) => {
  await page.getByTestId('btn-settings').click();
  await page.getByTestId('btn-test-vibration').click();
  // Headless Chromium has the Vibration API, so the "sent" hint shows.
  await expect(page.getByTestId('vibration-status')).toBeVisible();
});
