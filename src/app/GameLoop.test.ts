import { describe, expect, it } from 'vitest';
import { FixedClock } from '@core/clock';
import { GameLoop, MAX_FRAME_DT_S } from './GameLoop';

function makeLoop(step = 0.25): { loop: GameLoop; steps: number[]; renders: number[] } {
  const steps: number[] = [];
  const renders: number[] = [];
  const loop = new GameLoop(
    { step: (dt) => steps.push(dt), render: (alpha) => renders.push(alpha) },
    new FixedClock({ step, maxStepsPerAdvance: 100 }),
  );
  return { loop, steps, renders };
}

describe('GameLoop', () => {
  it('first frame renders without stepping', () => {
    const { loop, steps, renders } = makeLoop();
    loop.frame(1000);
    expect(steps).toEqual([]);
    expect(renders).toEqual([0]);
  });

  it('runs fixed steps from real time and passes alpha to render', () => {
    const { loop, steps, renders } = makeLoop(0.125);
    loop.frame(0);
    loop.frame(125); // exactly one step
    loop.frame(125 + 187.5); // 1.5 steps
    expect(steps).toEqual([0.125, 0.125]);
    expect(renders.at(-1)).toBeCloseTo(0.5);
  });

  it('clamps long frames (tab was in background)', () => {
    const { loop, steps } = makeLoop(0.125);
    loop.frame(0);
    loop.frame(60_000);
    expect(steps.length).toBe(MAX_FRAME_DT_S / 0.125);
  });

  it('ignores time going backwards', () => {
    const { loop, steps } = makeLoop(0.125);
    loop.frame(1000);
    loop.frame(500);
    expect(steps).toEqual([]);
  });

  it('hit-stop freezes simulation time but keeps rendering', () => {
    const { loop, steps, renders } = makeLoop(0.125);
    loop.frame(0);
    loop.hitStop(0.2);
    loop.frame(125); // 0.125 s, all frozen
    expect(steps).toEqual([]);
    loop.frame(250); // 0.075 frozen + 0.05 simulated
    expect(steps).toEqual([]);
    loop.frame(375); // + 0.125 → 0.175 accumulated → 1 step
    expect(steps).toEqual([0.125]);
    expect(renders.length).toBe(4);
    loop.hitStop(0.05);
    loop.hitStop(0.01); // shorter request doesn't cut the longer one
    loop.frame(375 + 50);
    expect(steps).toEqual([0.125]);
  });

  it('does nothing while paused and does not replay hidden time on resume', () => {
    const { loop, steps, renders } = makeLoop(0.125);
    loop.frame(0);
    loop.setPaused(true);
    expect(loop.isPaused).toBe(true);
    loop.frame(10_000);
    expect(renders.length).toBe(1);
    loop.setPaused(false);
    loop.frame(20_000);
    expect(steps).toEqual([]);
    loop.frame(20_125);
    expect(steps).toEqual([0.125]);
  });
});
