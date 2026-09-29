import { describe, expect, it } from 'vitest';
import { HOLD_DELAY_MS, TapTargeting, type GroundProjector } from './TapTargeting';

/** Fake camera: ground = screen / 100 + offset; `offset` simulates the camera moving. */
function setup() {
  const camera = { offsetX: 0 };
  const targets: [number, number][] = [];
  const project: GroundProjector = (cx, cy, out) => {
    if (cx < 0) return false; // off the floor
    out.x = cx / 100 + camera.offsetX;
    out.y = cy / 100;
    return true;
  };
  const tap = new TapTargeting(project, { setMoveTarget: (x, y) => targets.push([x, y]) });
  return { camera, targets, tap };
}

describe('TapTargeting', () => {
  it('aims immediately on press', () => {
    const { tap, targets } = setup();
    tap.press(300, 400, 0);
    expect(targets).toEqual([[3, 4]]);
    expect(tap.isHeld).toBe(true);
  });

  it('a new press on the same spot is a new command', () => {
    const { tap, targets } = setup();
    tap.press(300, 400, 0);
    tap.release();
    tap.press(300, 400, 0);
    expect(targets).toHaveLength(2);
  });

  it('a short tap is not re-aimed while the camera starts moving', () => {
    const { tap, targets, camera } = setup();
    tap.press(300, 400, 0);
    camera.offsetX = 0.5;
    tap.frame(HOLD_DELAY_MS - 1);
    tap.release();
    expect(targets).toEqual([[3, 4]]);
  });

  it('a held still finger re-aims every frame as the camera moves under it', () => {
    const { tap, targets, camera } = setup();
    tap.press(300, 400, 0);
    tap.frame(HOLD_DELAY_MS); // nothing moved
    expect(targets).toHaveLength(1);
    camera.offsetX = 0.5;
    tap.frame(HOLD_DELAY_MS + 16);
    expect(targets.at(-1)).toEqual([3.5, 4]);
  });

  it('ignores tiny drags and stops re-aiming after release', () => {
    const { tap, targets, camera } = setup();
    tap.press(300, 400, 0);
    tap.press(301, 400, 0); // 0.01 tiles
    expect(targets).toHaveLength(1);
    tap.press(320, 400, 0);
    expect(targets).toHaveLength(2);
    tap.release();
    camera.offsetX = 5;
    tap.frame(10_000);
    expect(targets).toHaveLength(2);
  });

  it('does nothing when the point misses the floor', () => {
    const { tap, targets } = setup();
    tap.press(-10, 400, 0);
    tap.frame(10_000);
    expect(targets).toEqual([]);
  });
});
