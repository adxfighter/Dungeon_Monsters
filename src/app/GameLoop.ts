import { FixedClock } from '@core/clock';

/** Longest real frame the loop accepts, seconds (tab switched, debugger pause). */
export const MAX_FRAME_DT_S = 0.25;

export interface GameLoopHooks {
  /** One fixed simulation step of `dt` seconds. */
  step(dt: number): void;
  /**
   * Draw with interpolation factor `alpha` ∈ [0, 1) between the previous and current step.
   * `frameDt` is the clamped real frame time (for cosmetic animation, FPS).
   */
  render(alpha: number, frameDt: number, rawFrameDt: number): void;
}

/**
 * Frame driver (ARCHITECTURE §5): real time → fixed steps (30 Hz) → render with interpolation.
 * Paused while the page is hidden; resuming never replays the hidden time.
 */
export class GameLoop {
  private readonly clock: FixedClock;
  private readonly hooks: GameLoopHooks;
  private lastMs: number | undefined;
  private paused = false;

  constructor(hooks: GameLoopHooks, clock = new FixedClock({ maxStepsPerAdvance: 8 })) {
    this.hooks = hooks;
    this.clock = clock;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get tick(): number {
    return this.clock.tick;
  }

  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    // Forget the last timestamp: the first frame after resume has dt = 0.
    this.lastMs = undefined;
  }

  /** Call once per animation frame with a monotonic timestamp in milliseconds. */
  frame(nowMs: number): void {
    if (this.paused) return;
    const rawDt = this.lastMs === undefined ? 0 : Math.max(0, (nowMs - this.lastMs) / 1000);
    this.lastMs = nowMs;
    const dt = Math.min(rawDt, MAX_FRAME_DT_S);

    const steps = this.clock.advance(dt);
    for (let i = 0; i < steps; i++) this.hooks.step(this.clock.step);
    this.hooks.render(this.clock.alpha, dt, rawDt);
  }
}
