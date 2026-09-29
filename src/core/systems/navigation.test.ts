import { describe, expect, it } from 'vitest';
import { createInputState, type InputState } from '@shared/input';
import { tavi } from '@content/characters/tavi';
import { Game } from '../Game';
import { MoveTarget, Transform, Velocity } from '../components';

const DT = 1 / 30;
/**
 *   row 0  #########
 *   row 1  #.......#
 *   row 2  #.#####.#
 *   row 3  #...P...#
 *   row 4  #########
 */
const room = { id: 'nav', rows: ['#########', '#.......#', '#.#####.#', '#...P...#', '#########'] };

class Driver {
  readonly game = new Game({ room, player: tavi });
  readonly input: InputState = createInputState();

  tap(x: number, y: number): void {
    this.input.target.seq++;
    this.input.target.x = x;
    this.input.target.y = y;
  }

  run(steps: number): void {
    for (let i = 0; i < steps; i++) this.game.step(this.input, DT);
  }

  get pos(): { x: number; y: number; rot: number } {
    return this.game.world.require(this.game.player, Transform);
  }

  get target() {
    return this.game.world.require(this.game.player, MoveTarget);
  }

  get speed(): number {
    const v = this.game.world.require(this.game.player, Velocity);
    return Math.hypot(v.x, v.y);
  }
}

describe('tap-to-move', () => {
  it('walks to the tapped point and stops there', () => {
    const d = new Driver();
    d.tap(7.2, 3.4);
    d.run(90);
    expect(d.pos.x).toBeCloseTo(7.2, 1);
    expect(d.pos.y).toBeCloseTo(3.4, 1);
    expect(d.target.active).toBe(false);
    expect(d.speed).toBeLessThan(0.05);
  });

  it('starts moving on the very next step (≤ 1 step latency)', () => {
    const d = new Driver();
    const x0 = d.pos.x;
    d.tap(7.5, 3.5);
    d.run(1);
    expect(d.pos.x).toBeGreaterThan(x0);
  });

  it('goes around a wall to reach a point behind it', () => {
    const d = new Driver();
    d.tap(4.5, 1.5); // straight above the spawn, behind the wall row 2
    let minY = Infinity;
    let maxDx = 0;
    for (let i = 0; i < 240; i++) {
      d.run(1);
      minY = Math.min(minY, d.pos.y);
      maxDx = Math.max(maxDx, Math.abs(d.pos.x - 4.5));
    }
    expect(d.pos.x).toBeCloseTo(4.5, 1);
    expect(d.pos.y).toBeCloseTo(1.5, 1);
    expect(maxDx).toBeGreaterThan(2); // detoured through a side gap
  });

  it('does not overshoot the target', () => {
    const d = new Driver();
    d.tap(7.0, 3.5);
    let maxX = 0;
    for (let i = 0; i < 90; i++) {
      d.run(1);
      maxX = Math.max(maxX, d.pos.x);
    }
    expect(maxX).toBeLessThan(7.0 + 0.05);
  });

  it('a tap inside a wall walks to the nearest floor next to it', () => {
    const d = new Driver();
    d.tap(4.5, 2.5); // wall directly above
    d.run(60);
    expect(Math.floor(d.pos.y)).toBe(3);
    expect(d.target.active).toBe(false);
  });

  it('ignores an unreachable tap', () => {
    const d = new Driver();
    d.tap(40, 40);
    d.run(10);
    expect(d.target.active).toBe(false);
    expect(d.pos).toMatchObject({ x: 4.5, y: 3.5 });
  });

  it('dragging updates the target without restarting the plan', () => {
    const d = new Driver();
    d.tap(6.2, 3.5);
    d.run(5);
    const waypoints = d.target.waypoints;
    d.tap(6.8, 3.4); // same tile
    d.run(1);
    expect(d.target.waypoints).toBe(waypoints);
    expect(d.target.x).toBeCloseTo(6.8);
    d.run(90);
    expect(d.pos.x).toBeCloseTo(6.8, 1);
  });

  it('keyboard / joystick input cancels the tap target', () => {
    const d = new Driver();
    d.tap(7.5, 3.5);
    d.run(5);
    d.input.move.x = -1;
    d.run(1);
    expect(d.target.active).toBe(false);
    d.input.move.x = 0;
    d.run(30);
    expect(d.target.active).toBe(false); // the old tap is not resumed
  });

  it('is deterministic', () => {
    const run = (): unknown => {
      const d = new Driver();
      d.tap(1.5, 1.5);
      d.run(50);
      d.tap(7.5, 1.5);
      d.run(100);
      return { ...d.pos };
    };
    expect(run()).toEqual(run());
  });
});
