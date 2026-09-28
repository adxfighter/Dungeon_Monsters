/** Exponential smoothing factor for the FPS estimate (per frame). */
const SMOOTHING = 0.1;
/** Frame times above this are pauses (tab hidden, debugger), not real frames. */
const MAX_FRAME_S = 0.5;

/** Smoothed frames-per-second estimate from frame deltas. */
export class FpsMeter {
  private smoothedDt = 0;

  /** Records one frame of `dtSeconds`; returns the current smoothed FPS. */
  push(dtSeconds: number): number {
    if (dtSeconds > 0 && dtSeconds <= MAX_FRAME_S) {
      this.smoothedDt =
        this.smoothedDt === 0 ? dtSeconds : this.smoothedDt + (dtSeconds - this.smoothedDt) * SMOOTHING;
    }
    return this.fps;
  }

  get fps(): number {
    return this.smoothedDt > 0 ? 1 / this.smoothedDt : 0;
  }
}
