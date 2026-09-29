import { expect, test, type CDPSession, type Page } from '@playwright/test';

/**
 * Joystick control e2e (`?joystick=1`, kept for comparison with tap-to-move). Playwright has no finger-drag API, so touches go through CDP
 * `Input.dispatchTouchEvent`; Chromium turns them into Pointer Events for the joystick.
 */

interface Pos {
  x: number;
  y: number;
}

const playerPos = (page: Page): Promise<Pos> =>
  page.evaluate(() => {
    const pos = window.__debug?.getPlayerPos();
    if (!pos) throw new Error('window.__debug is not available (dev build expected)');
    return pos;
  });

type TouchPoint = { x: number; y: number; id: number };

async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', points: TouchPoint[]) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 4, radiusY: 4, force: 1 })),
  });
}

/** Presses a finger at `from`, slides to `to` in a few moves, holds for `holdMs`, releases. */
async function drag(page: Page, cdp: CDPSession, from: Pos, to: Pos, holdMs: number): Promise<void> {
  await touch(cdp, 'touchStart', [{ ...from, id: 1 }]);
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    await touch(cdp, 'touchMove', [
      { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, id: 1 },
    ]);
  }
  await page.waitForTimeout(holdMs);
  await touch(cdp, 'touchEnd', []);
}

test.beforeEach(async ({ page }) => {
  // Low render resolution: SwiftShader frames are slow, and slow frames delay pointer events.
  await page.goto('/?room=test_room&joystick=1&pr=0.5');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
});

test('dragging in the left half moves the hero', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const start = await playerPos(page);
  await drag(page, cdp, { x: 100, y: 600 }, { x: 170, y: 600 }, 700);
  const end = await playerPos(page);
  expect(end.x - start.x).toBeGreaterThan(0.8);
  expect(Math.abs(end.y - start.y)).toBeLessThan(0.3);
});

test('the hero does not walk through the north wall', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  // Straight up from the spawn: floor column between the pillars, then the outer wall (y = 1).
  await drag(page, cdp, { x: 100, y: 600 }, { x: 100, y: 500 }, 2500);
  const end = await playerPos(page);
  expect(end.y).toBeGreaterThanOrEqual(1.29);
  expect(end.y).toBeLessThan(1.4);
});

test('a second finger on the right half does not disturb the joystick', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const start = await playerPos(page);
  const stick = { x: 100, y: 600, id: 1 };
  await touch(cdp, 'touchStart', [stick]);
  await touch(cdp, 'touchMove', [{ ...stick, x: 170 }]);
  // Second finger lands and moves on the right half while the first keeps pushing right.
  const other = { x: 320, y: 500, id: 2 };
  await touch(cdp, 'touchStart', [{ ...stick, x: 170 }, other]);
  await touch(cdp, 'touchMove', [
    { ...stick, x: 170 },
    { ...other, x: 250, y: 400 },
  ]);
  await page.waitForTimeout(600);
  await touch(cdp, 'touchEnd', [{ ...stick, x: 170 }]); // second finger lifts
  await page.waitForTimeout(300);
  const mid = await playerPos(page);
  await touch(cdp, 'touchEnd', []);
  expect(mid.x - start.x).toBeGreaterThan(0.8);
  expect(Math.abs(mid.y - start.y)).toBeLessThan(0.3);
});

test('keyboard WASD moves the hero (desktop fallback)', async ({ page }) => {
  const start = await playerPos(page);
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyA');
  const end = await playerPos(page);
  expect(start.x - end.x).toBeGreaterThan(0.5);
});

test('backgrounding mid-drag resets the joystick so the next touch works', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await touch(cdp, 'touchStart', [{ x: 100, y: 600, id: 1 }]);
  await touch(cdp, 'touchMove', [{ x: 170, y: 600, id: 1 }]);
  // Simulate the app going to background without any pointerup/cancel reaching the page.
  const setHidden = (hidden: boolean): Promise<void> =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  await setHidden(false);
  await expect(page.locator('.joystick-base')).toBeHidden();

  const start = await playerPos(page);
  // New finger (new id) drags left: must steer even though finger 1 never "lifted".
  await touch(cdp, 'touchStart', [
    { x: 170, y: 600, id: 1 },
    { x: 150, y: 650, id: 2 },
  ]);
  await touch(cdp, 'touchMove', [
    { x: 170, y: 600, id: 1 },
    { x: 80, y: 650, id: 2 },
  ]);
  await page.waitForTimeout(600);
  const end = await playerPos(page);
  await touch(cdp, 'touchEnd', []);
  expect(start.x - end.x).toBeGreaterThan(0.5);
});
