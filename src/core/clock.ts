/**
 * Fixed-step simulation clock (ARCHITECTURE §5).
 * The platform feeds real elapsed time; the clock says how many fixed steps to simulate
 * and the interpolation factor for rendering. Core never reads wall-clock time itself.
 */

/** Simulation rate, Hz. */
export const SIM_HZ = 30;

export interface FixedClockOptions {
  /** Fixed step, seconds. Default 1 / SIM_HZ. */
  step?: number;
  /** Max steps per advance; excess time (tab in background, debugger pause) is dropped. Default 5. */
  maxStepsPerAdvance?: number;
}

export class FixedClock {
  readonly step: number;
  readonly maxStepsPerAdvance: number;
  private ticks = 0;
  private accumulator = 0;

  constructor(options: FixedClockOptions = {}) {
    this.step = options.step ?? 1 / SIM_HZ;
    this.maxStepsPerAdvance = options.maxStepsPerAdvance ?? 5;
    if (!(this.step > 0) || !Number.isFinite(this.step)) {
      throw new RangeError('FixedClock: step must be a finite number > 0');
    }
    if (!Number.isInteger(this.maxStepsPerAdvance) || this.maxStepsPerAdvance < 1) {
      throw new RangeError('FixedClock: maxStepsPerAdvance must be an integer >= 1');
    }
  }

  /** Total fixed steps simulated since creation / reset. */
  get tick(): number {
    return this.ticks;
  }

  /** Simulated time, seconds. */
  get time(): number {
    return this.ticks * this.step;
  }

  /** Interpolation factor in [0, 1) between the previous and the current simulated state. */
  get alpha(): number {
    return this.accumulator / this.step;
  }

  /**
   * Adds real elapsed time (seconds) and returns the number of fixed steps to run now.
   * Negative, NaN or infinite input is treated as 0.
   */
  advance(elapsedSeconds: number): number {
    if (Number.isFinite(elapsedSeconds) && elapsedSeconds > 0) this.accumulator += elapsedSeconds;
    let steps = Math.floor(this.accumulator / this.step);
    if (steps > this.maxStepsPerAdvance) {
      // Spiral-of-death guard: drop the backlog instead of simulating it.
      steps = this.maxStepsPerAdvance;
      this.accumulator = 0;
    } else {
      this.accumulator -= steps * this.step;
    }
    this.ticks += steps;
    return steps;
  }

  reset(): void {
    this.ticks = 0;
    this.accumulator = 0;
  }
}
