import { describe, expect, it } from 'vitest';
import { createInputState, type InputState } from '@shared/input';
import { tavi } from '@content/characters/tavi';
import { Game } from '../Game';
import { PrevTransform, Transform, Velocity } from '../components';
import { turnToward, wrapAngle } from './movement';

const DT = 1 / 30;
const openRoom = {
  id: 'open',
  rows: [
    '###########',
    '#.........#',
    '#.........#',
    '#....P....#',
    '#.........#',
    '#.........#',
    '###########',
  ],
};

function input(x: number, y: number): InputState {
  const state = createInputState();
  state.move.x = x;
  state.move.y = y;
  return state;
}

function makeGame(): Game {
  return new Game({ room: openRoom, player: tavi });
}

describe('angles', () => {
  it('wraps to (-π, π]', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(Math.PI / 2 + 4 * Math.PI)).toBeCloseTo(Math.PI / 2);
  });

  it('turns along the shortest arc with a limited step', () => {
    expect(turnToward(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(turnToward(0, 1, 2)).toBeCloseTo(1);
    // From just below +π to just above -π: shortest path crosses π, not 0.
    expect(turnToward(3, -3, 0.1)).toBeCloseTo(3.1);
  });
});

describe('player movement', () => {
  it('accelerates up to max speed and not beyond', () => {
    const game = makeGame();
    game.step(input(1, 0), DT);
    const v = game.world.require(game.player, Velocity);
    expect(v.x).toBeCloseTo(tavi.movement.accel * DT);
    for (let i = 0; i < 30; i++) game.step(input(1, 0), DT);
    expect(v.x).toBeCloseTo(tavi.movement.speed);
  });

  it('normalizes input longer than 1', () => {
    const game = makeGame();
    for (let i = 0; i < 6; i++) game.step(input(3, 4), DT); // reaches max speed before any wall
    const v = game.world.require(game.player, Velocity);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(tavi.movement.speed);
  });

  it('decelerates to a full stop without overshooting', () => {
    const game = makeGame();
    for (let i = 0; i < 30; i++) game.step(input(1, 0), DT);
    const v = game.world.require(game.player, Velocity);
    for (let i = 0; i < 30; i++) game.step(input(0, 0), DT);
    expect(v).toEqual({ x: 0, y: 0 });
  });

  it('responds to input within one step (no input lag)', () => {
    const game = makeGame();
    const start = { ...game.world.require(game.player, Transform) };
    game.step(input(0, -1), DT);
    expect(game.world.require(game.player, Transform).y).toBeLessThan(start.y);
  });

  it('turns toward the move direction with limited angular speed', () => {
    const game = makeGame();
    const t = game.world.require(game.player, Transform);
    expect(t.rot).toBe(0); // faces +y (toward the camera)
    game.step(input(0, -1), DT); // request facing -y (rot = π)
    expect(Math.abs(t.rot)).toBeCloseTo(tavi.movement.turnRate * DT);
    for (let i = 0; i < 30; i++) game.step(input(0, -1), DT);
    expect(Math.abs(t.rot)).toBeCloseTo(Math.PI);
  });

  it('keeps facing when input stops', () => {
    const game = makeGame();
    for (let i = 0; i < 30; i++) game.step(input(1, 0), DT);
    const t = game.world.require(game.player, Transform);
    const rot = t.rot;
    for (let i = 0; i < 10; i++) game.step(input(0, 0), DT);
    expect(t.rot).toBe(rot);
  });

  it('stores the previous transform for interpolation', () => {
    const game = makeGame();
    game.step(input(1, 0), DT);
    const before = { ...game.world.require(game.player, Transform) };
    game.step(input(1, 0), DT);
    expect(game.world.require(game.player, PrevTransform)).toEqual(before);
  });

  it('is deterministic for the same input sequence', () => {
    const run = (): unknown => {
      const game = makeGame();
      for (let i = 0; i < 200; i++) game.step(input(Math.sin(i * 0.1), Math.cos(i * 0.07)), DT);
      return game.transformOf(game.player);
    };
    expect(run()).toEqual(run());
  });

  it('stays inside the room when pushing against walls for a long time', () => {
    const game = makeGame();
    for (let i = 0; i < 300; i++) game.step(input(1, 1), DT);
    const t = game.world.require(game.player, Transform);
    expect(t.x).toBeCloseTo(10 - tavi.radius, 6);
    expect(t.y).toBeCloseTo(6 - tavi.radius, 6);
  });

  it('emits EntitySpawned for the player once', () => {
    const game = makeGame();
    expect(game.drainEvents()).toEqual([
      { type: 'EntitySpawned', entity: game.player, kind: 'player', defId: 'tavi' },
    ]);
    expect(game.drainEvents()).toEqual([]);
  });
});
