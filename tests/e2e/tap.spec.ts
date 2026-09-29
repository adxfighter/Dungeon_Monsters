import { expect, test, type CDPSession, type Page } from '@playwright/test';

/**
 * Tap-to-move e2e (default controls, GDD §4.1). Touches go through CDP `Input.dispatchTouchEvent`.
 * Test room: spawn (6.5, 5.5); walls in row 7 except the corridors at x = 4 and x = 8.
 * The camera shows only ~4 tiles across, so every tapped point must be near the hero to be on screen.
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

/** Client (CSS px) position of a simulation-space ground point. */
const onScreen = (page: Page, x: number, y: number): Promise<Pos> =>
  page.evaluate(
    ([gx, gy]) => {
      const d = window.__debug;
      if (!d) throw new Error('window.__debug is not available');
      return d.groundToClient(gx as number, gy as number);
    },
    [x, y],
  );

async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', points: Pos[]) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })),
  });
}

async function tap(cdp: CDPSession, at: Pos): Promise<void> {
  await touch(cdp, 'touchStart', [at]);
  await touch(cdp, 'touchEnd', []);
}

/** Polls until the hero is within `tolerance` of the point (or fails after `timeoutMs`). */
async function expectArrive(page: Page, x: number, y: number, tolerance: number, timeoutMs: number) {
  await expect
    .poll(
      async () => {
        const p = await playerPos(page);
        return Math.hypot(p.x - x, p.y - y);
      },
      { timeout: timeoutMs },
    )
    .toBeLessThan(tolerance);
}

test.beforeEach(async ({ page }) => {
  // Low render resolution: SwiftShader frames are slow, and slow frames delay pointer events.
  await page.goto('/?room=test_room&pr=0.5');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
});

test('tapping the floor walks the hero to that point', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const at = await onScreen(page, 7.8, 5.2);
  await tap(cdp, at);
  await expectArrive(page, 7.8, 5.2, 0.15, 5000);
});

test('the hero walks around walls through a corridor', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  // Step toward the left corridor so it is on screen, then tap inside it: the straight line crosses the
  // wall tile (5, 7), so the hero has to go around through the corridor mouth at (4.5, 6.5).
  await tap(cdp, await onScreen(page, 5.3, 6.4));
  await expectArrive(page, 5.3, 6.4, 0.15, 5000);
  await page.waitForTimeout(400); // let the camera settle
  const at = await onScreen(page, 4.5, 8.5);
  expect(at.x).toBeGreaterThan(0);
  await tap(cdp, at);
  await expectArrive(page, 4.5, 8.5, 0.2, 8000);
});

test('dragging moves the target with the finger', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const from = { x: 6.5, y: 4.8 };
  const to = { x: 7.5, y: 5.0 };
  await touch(cdp, 'touchStart', [await onScreen(page, from.x, from.y)]);
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    // Re-project every step: the camera follows the hero while the finger drags.
    await touch(cdp, 'touchMove', [
      await onScreen(page, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t),
    ]);
  }
  await touch(cdp, 'touchEnd', []);
  // The camera keeps following the hero while the finger moves (and a held finger re-aims), so the exact floor point
  // under the finger when the app handles the last move differs from a point computed here in advance. Check the
  // behaviour instead: wait until the walk ends (the target stays readable after it deactivates), then the hero is at
  // the final target, and that target moved along the drag (right, on the `to` row) — a plain tap would stay at `from`.
  await expect
    .poll(async () => (await page.evaluate(() => window.__debug?.getMoveTarget()))?.active, { timeout: 8000 })
    .toBe(false);
  const target = await page.evaluate(() => window.__debug?.getMoveTarget());
  const tx = target?.x ?? 0;
  const ty = target?.y ?? 0;
  expect(tx - from.x).toBeGreaterThan(0.5);
  expect(tx).toBeLessThan(to.x + 0.5); // the hold re-aim may push it a little past `to`, never to the wall
  expect(Math.abs(ty - to.y)).toBeLessThan(0.3);
  const hero = await playerPos(page);
  expect(Math.hypot(hero.x - tx, hero.y - ty)).toBeLessThan(0.25);
});

test('holding a still finger keeps walking toward it as the camera follows', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const start = await playerPos(page);
  await touch(cdp, 'touchStart', [await onScreen(page, start.x + 1.5, start.y)]);
  await page.waitForTimeout(2500);
  const held = await playerPos(page);
  await touch(cdp, 'touchEnd', []);
  // A single tap would stop 1.5 tiles away; holding carries the hero on to the east wall area.
  expect(held.x - start.x).toBeGreaterThan(2.5);
});

test('the hero stays put after arriving', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await tap(cdp, await onScreen(page, 5.5, 4.5));
  await expectArrive(page, 5.5, 4.5, 0.15, 5000);
  const before = await playerPos(page);
  await page.waitForTimeout(500);
  const after = await playerPos(page);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.02);
});
