import { expect, test, type CDPSession, type Page } from '@playwright/test';

/** Combat e2e (M2): buttons, damage, defeat screen. Arena is the default scene; spawn: (6.5, 5.5). */

async function tapElement(cdp: CDPSession, page: Page, testId: string): Promise<void> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} not visible`);
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Opens the arena and starts it on `level` from the difficulty picker. */
async function startArena(page: Page, level: 'easy' | 'medium' | 'hard' = 'hard'): Promise<void> {
  // Low render resolution: SwiftShader frames are slow, and slow frames delay input events.
  await page.goto('/?pr=0.5');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  await page.getByTestId(`difficulty-${level}`).click();
  await expect(page.getByTestId('difficulty-picker')).toHaveCount(0);
}

test.beforeEach(async ({ page }, info) => {
  if (info.title.startsWith('picker:')) return; // picker tests drive the start screen themselves
  await startArena(page);
});

test('picker: the arena starts with a difficulty choice, medium pre-selected, the choice is remembered', async ({
  page,
}) => {
  await page.goto('/?pr=0.5');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  const picker = page.getByTestId('difficulty-picker');
  await expect(picker).toContainText('Выберите сложность');
  await expect(page.getByTestId('difficulty-medium')).toHaveClass(/selected/);
  await page.getByTestId('difficulty-easy').click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByTestId('wave')).toContainText(/Волна \d\/3/, { timeout: 5000 }); // easy = 3 waves
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  await expect(page.getByTestId('difficulty-easy')).toHaveClass(/selected/);
});

test('picker: no waves spawn before a level is picked', async ({ page }) => {
  await page.goto('/?pr=0.5');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  await page.waitForTimeout(2500); // longer than the first wave delay
  const alive = await page.evaluate(() => window.__debug?.getMonsters().length);
  expect(alive).toBe(0);
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
  const bag = await page.getByTestId('btn-backpack').boundingBox();
  expect(bag?.width).toBeGreaterThanOrEqual(48);
});

test('the attack button damages a monster in front of the hero', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => window.__debug?.spawnMonster('fugu', 6.5, 6.2));
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
    window.__debug?.spawnMonster('toadhog', 6.5, 6.3);
  });
  const screen = page.getByTestId('end-screen');
  await expect(screen).toBeVisible({ timeout: 10_000 });
  await expect(screen).toContainText('Вас вынесли');
  await screen.getByRole('button').click();
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  await expect(page.getByTestId('difficulty-picker')).toBeVisible(); // a new run starts with the choice
  await expect(page.getByTestId('hero-hp')).toContainText('100 / 100');
});

test('a decapus grab shows the break-free hint, and mashing Attack frees the hero', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    window.__debug?.setHeroHp(100000);
    window.__debug?.spawnMonster('decapus', 6.5, 6.2);
  });
  const hint = page.getByTestId('grab-hint');
  await expect(hint).toBeVisible({ timeout: 10_000 });
  await expect(hint).toContainText('Удар');
  for (let i = 0; i < 12 && (await hint.isVisible()); i++) await tapElement(cdp, page, 'btn-attack');
  await expect(hint).toBeHidden({ timeout: 4000 });
});

test('a killed monster leaves a carcass: Butcher puts its parts in the backpack (loot line)', async ({
  page,
}) => {
  const cdp = await page.context().newCDPSession(page);
  await expect(page.getByTestId('btn-butcher')).toHaveCount(0);
  await page.evaluate(() => {
    window.__debug?.setHeroHp(100000);
    window.__debug?.spawnMonster('yak', 6.5, 6.1);
    window.__debug?.killMonsters();
  });
  const butcher = page.getByTestId('btn-butcher');
  await expect(butcher).toBeVisible({ timeout: 5000 });
  await tapElement(cdp, page, 'btn-butcher');
  // The butchery board: swipe along each dashed line (the fight is paused meanwhile).
  const board = page.getByTestId('butchery-board');
  await expect(board).toBeVisible();
  for (let part = 0; part < 2; part++) {
    const line = JSON.parse((await board.getAttribute('data-line')) ?? '[]') as [number, number][];
    const box = await board.boundingBox();
    if (!box || line.length < 2) throw new Error('no board / line');
    const at = (x: number, y: number) => ({ x: box.x + x * box.width, y: box.y + y * box.height, id: 1 });
    const pts: { x: number; y: number; id: number }[] = [];
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, ay] = line[i] as [number, number];
      const [bx, by] = line[i + 1] as [number, number];
      for (let k = 0; k < 6; k++) pts.push(at(ax + ((bx - ax) * k) / 6, ay + ((by - ay) * k) / 6));
    }
    const [lx, ly] = line[line.length - 1] as [number, number];
    pts.push(at(lx, ly));
    const first = pts[0];
    if (!first) throw new Error('empty stroke');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
    for (const p of pts.slice(1))
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  // Clean cuts on a debug (blunt) kill: the steak comes out ★3.
  await expect(page.getByTestId('loot-toasts')).toContainText('Стейк яка ★★★', { timeout: 5000 });
  await expect(page.getByTestId('butchery')).toHaveCount(0);
  await expect(butcher).toHaveCount(0);
});

test('simplified butchery: tap the dots; a miss costs a star but does not skip a dot', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await page.getByTestId('btn-settings').click();
  await page.getByTestId('toggle-butcher-taps').check();
  await page.getByTestId('btn-settings').click();
  await page.evaluate(() => {
    window.__debug?.setHeroHp(100000);
    window.__debug?.spawnMonster('yak', 6.5, 6.1);
    window.__debug?.killMonsters();
  });
  await expect(page.getByTestId('btn-butcher')).toBeVisible({ timeout: 5000 });
  await tapElement(cdp, page, 'btn-butcher');
  const board = page.getByTestId('butchery-board');
  const tapAt = async (x: number, y: number) => {
    const box = await board.boundingBox();
    if (!box) throw new Error('no board');
    const at = { x: box.x + x * box.width, y: box.y + y * box.height, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  for (let part = 0; part < 2; part++) {
    const line = JSON.parse((await board.getAttribute('data-line')) ?? '[]') as [number, number][];
    for (let i = 0; i < line.length; i++) {
      const [x, y] = line[i] as [number, number];
      if (part === 0 && i === 1) await tapAt(0.95, 0.95); // one miss on the first part
      await tapAt(x, y);
    }
  }
  const toasts = page.getByTestId('loot-toasts');
  await expect(toasts).toContainText('Стейк яка ★★', { timeout: 5000 });
  await expect(toasts).not.toContainText('Стейк яка ★★★');
  await expect(toasts).toContainText('Жир с горба яка ★★★');
});

test('gathering a plant and throwing it away in the backpack screen', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    window.__debug?.setHeroHp(100000);
    window.__debug?.setPlayerPos(2.5, 2.4); // next to the glowcap (2.5, 1.6)
  });
  await expect(page.getByTestId('btn-gather')).toBeVisible({ timeout: 5000 });
  await tapElement(cdp, page, 'btn-gather');
  await expect(page.getByTestId('loot-toasts')).toContainText('Светогриб ★★', { timeout: 5000 });
  await page.getByTestId('btn-backpack').click();
  await expect(page.getByTestId('backpack')).toBeVisible();
  await expect(page.getByTestId('stack-glowcap-2')).toContainText('×2');
  const discardBox = await page.getByTestId('discard-glowcap-2').boundingBox();
  expect(discardBox?.height).toBeGreaterThanOrEqual(48); // ≥ 48 dp
  await page.getByTestId('discard-glowcap-2').click();
  await expect(page.getByTestId('stack-glowcap-2')).toContainText('×1');
  await page.getByTestId('discard-glowcap-2').click();
  await expect(page.getByTestId('stack-glowcap-2')).toHaveCount(0);
  await page.getByTestId('backpack-close').click();
  await expect(page.getByTestId('backpack')).toHaveCount(0);
});

test('bestiary: a met monster opens its page; butchering adds its parts', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    window.__debug?.setHeroHp(100000);
    window.__debug?.spawnMonster('decapus', 6.5, 6.1);
  });
  await page.getByTestId('btn-backpack').click();
  await page.getByTestId('tab-bestiary').click();
  await expect(page.getByTestId('bestiary-decapus')).toContainText('Десятиног');
  await page.getByTestId('bestiary-decapus').click();
  await expect(page.getByTestId('bestiary-page-decapus')).toContainText('Разделайте, чтобы узнать');
  await page.getByTestId('backpack-close').click();
  await page.evaluate(() => window.__debug?.killMonsters());
  await expect(page.getByTestId('btn-butcher')).toBeVisible({ timeout: 5000 });
  await tapElement(cdp, page, 'btn-butcher');
  await page.getByTestId('butchery-skip').click();
  await page.getByTestId('btn-backpack').click();
  await page.getByTestId('tab-bestiary').click();
  await page.getByTestId('bestiary-decapus').click();
  await expect(page.getByTestId('bestiary-parts')).toContainText('Щупальце десятинога');
});

test('skipping the butchery gives ★1 for everything', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    window.__debug?.setHeroHp(100000);
    window.__debug?.spawnMonster('yak', 6.5, 6.1);
    window.__debug?.killMonsters();
  });
  await expect(page.getByTestId('btn-butcher')).toBeVisible({ timeout: 5000 });
  await tapElement(cdp, page, 'btn-butcher');
  await page.getByTestId('butchery-skip').click();
  await expect(page.getByTestId('loot-toasts')).toContainText('Стейк яка ★', { timeout: 5000 });
  await expect(page.getByTestId('loot-toasts')).not.toContainText('★★');
});

test('the swap button switches blade ↔ torch', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const swap = page.getByTestId('btn-swap');
  await expect(swap).toHaveText('Клинок');
  await tapElement(cdp, page, 'btn-swap');
  await expect(swap).toHaveText('Факел');
  await tapElement(cdp, page, 'btn-swap');
  await expect(swap).toHaveText('Клинок');
});

test('enemies show HP bars and hits pop damage numbers', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => window.__debug?.spawnMonster('fugu', 6.5, 6.2));
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
  await startArena(page);
  await page.getByTestId('btn-settings').click();
  await expect(page.getByTestId('settings').getByRole('checkbox').first()).not.toBeChecked();
});

test('action buttons: right by default, dodge above attack, side switch persists', async ({ page }) => {
  const attack = await page.getByTestId('btn-attack').boundingBox();
  const dodge = await page.getByTestId('btn-dodge').boundingBox();
  if (!attack || !dodge) throw new Error('buttons not visible');
  const vw = page.viewportSize()?.width ?? 390;
  expect(attack.x + attack.width / 2).toBeGreaterThan(vw / 2); // right side (user default)
  expect(dodge.y + dodge.height).toBeLessThanOrEqual(attack.y); // dodge stacked above
  expect(attack.width).toBeGreaterThan(dodge.width);

  await page.getByTestId('btn-settings').click();
  await page.getByTestId('side-left').click();
  const moved = await page.getByTestId('btn-attack').boundingBox();
  expect((moved?.x ?? 0) + (moved?.width ?? 0) / 2).toBeLessThan(vw / 2);
  await startArena(page);
  const after = await page.getByTestId('btn-attack').boundingBox();
  expect((after?.x ?? 0) + (after?.width ?? 0) / 2).toBeLessThan(vw / 2);
});

test('the vibration test explains the result', async ({ page }) => {
  await page.getByTestId('btn-settings').click();
  await page.getByTestId('btn-test-vibration').click();
  // Headless Chromium has the Vibration API, so the "sent" hint shows.
  await expect(page.getByTestId('vibration-status')).toBeVisible();
});

test('picker: one arena, no arena tabs; easy starts with its first wave', async ({ page }) => {
  await page.goto('/?pr=0.5');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  await expect(page.getByTestId('difficulty-picker')).toBeVisible();
  await expect(page.locator('[role=tab]')).toHaveCount(0);
  await page.getByTestId('difficulty-easy').click();
  await expect
    .poll(() => page.evaluate(() => window.__debug?.getMonsters().map((m) => m.id) ?? []), { timeout: 6000 })
    .toEqual(expect.arrayContaining(['toadhog', 'brooklash']));
});
