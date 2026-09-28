import { describe, expect, it } from 'vitest';
import { FpsMeter } from './FpsMeter';

describe('FpsMeter', () => {
  it('starts at 0 and converges to the frame rate', () => {
    const meter = new FpsMeter();
    expect(meter.fps).toBe(0);
    for (let i = 0; i < 200; i++) meter.push(1 / 60);
    expect(meter.fps).toBeCloseTo(60, 5);
    for (let i = 0; i < 200; i++) meter.push(1 / 30);
    expect(meter.fps).toBeCloseTo(30, 1);
  });

  it('ignores zero, negative and pause-length frames', () => {
    const meter = new FpsMeter();
    meter.push(1 / 60);
    for (const dt of [0, -1, 5, Number.NaN]) meter.push(dt);
    expect(meter.fps).toBeCloseTo(60, 5);
  });
});
