import { describe, expect, it } from 'vitest';
import { FixedClock, SIM_HZ } from './clock';

// Step 0.25 is exact in binary floating point, so these tests are free of rounding noise.
const make = (maxStepsPerAdvance = 5): FixedClock => new FixedClock({ step: 0.25, maxStepsPerAdvance });

describe('FixedClock', () => {
  it('defaults to SIM_HZ', () => {
    expect(new FixedClock().step).toBeCloseTo(1 / SIM_HZ);
    expect(SIM_HZ).toBe(30);
  });

  it('accumulates partial frames and reports alpha', () => {
    const clock = make();
    expect(clock.advance(0.125)).toBe(0);
    expect(clock.alpha).toBe(0.5);
    expect(clock.advance(0.125)).toBe(1);
    expect(clock.alpha).toBe(0);
    expect(clock.advance(0.625)).toBe(2);
    expect(clock.alpha).toBe(0.5);
    expect(clock.tick).toBe(3);
    expect(clock.time).toBe(0.75);
  });

  it('treats dt = 0, negative, NaN and Infinity as no time', () => {
    const clock = make();
    for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(clock.advance(dt)).toBe(0);
    }
    expect(clock.tick).toBe(0);
    expect(clock.alpha).toBe(0);
  });

  it('caps steps after a long pause and drops the backlog', () => {
    const clock = make(4);
    expect(clock.advance(60)).toBe(4);
    expect(clock.alpha).toBe(0);
    expect(clock.advance(0.25)).toBe(1);
  });

  it('is deterministic: same frame times give the same steps', () => {
    const frames = [0.016, 0.017, 0.2, 0.001, 0.05, 0.033, 0.5];
    const run = (): number[] => {
      const clock = new FixedClock();
      return frames.map((dt) => clock.advance(dt));
    };
    expect(run()).toEqual(run());
  });

  it('runs about SIM_HZ steps per simulated second at 60 FPS', () => {
    const clock = new FixedClock();
    let steps = 0;
    for (let i = 0; i < 600; i++) steps += clock.advance(1 / 60);
    expect(Math.abs(steps - SIM_HZ * 10)).toBeLessThanOrEqual(1);
  });

  it('reset() clears ticks and accumulator', () => {
    const clock = make();
    clock.advance(0.375);
    clock.reset();
    expect(clock.tick).toBe(0);
    expect(clock.alpha).toBe(0);
  });

  it('rejects invalid options', () => {
    expect(() => new FixedClock({ step: 0 })).toThrow(RangeError);
    expect(() => new FixedClock({ step: Number.NaN })).toThrow(RangeError);
    expect(() => new FixedClock({ maxStepsPerAdvance: 0 })).toThrow(RangeError);
    expect(() => new FixedClock({ maxStepsPerAdvance: 1.5 })).toThrow(RangeError);
  });
});
