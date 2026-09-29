/** Held-finger re-aim threshold: ground movement (tiles) below this doesn't issue a new target. */
const MIN_REAIM_TILES = 0.05;
/**
 * A still finger starts re-aiming only after this long (ms). Shorter contacts are taps: re-aiming them while
 * the camera already follows the hero would drag the target away from where the player tapped.
 */
export const HOLD_DELAY_MS = 350;

export type GroundProjector = (clientX: number, clientY: number, out: { x: number; y: number }) => boolean;

export interface MoveTargetSink {
  setMoveTarget(x: number, y: number): void;
}

/**
 * Turns tap-to-move pointer state into ground targets. A press aims immediately; a drag re-aims as the finger
 * moves; a finger held longer than HOLD_DELAY_MS is re-projected every frame (the camera follows the hero, so
 * the ground under a still finger moves) — holding keeps walking toward the finger, as GDD §4.1 describes.
 */
export class TapTargeting {
  private readonly project: GroundProjector;
  private readonly sink: MoveTargetSink;
  private held = false;
  private pressedAt = 0;
  private clientX = 0;
  private clientY = 0;
  private lastX = Number.NaN;
  private lastY = Number.NaN;
  private readonly ground = { x: 0, y: 0 };

  constructor(project: GroundProjector, sink: MoveTargetSink) {
    this.project = project;
    this.sink = sink;
  }

  get isHeld(): boolean {
    return this.held;
  }

  press(clientX: number, clientY: number, nowMs: number): void {
    const wasHeld = this.held;
    this.held = true;
    if (!wasHeld) this.pressedAt = nowMs;
    this.clientX = clientX;
    this.clientY = clientY;
    // A new touch is always a new command, even on the same spot; a drag only when it moved enough.
    this.aim(!wasHeld);
  }

  release(): void {
    this.held = false;
  }

  /** Call once per rendered frame, after the camera has been updated. */
  frame(nowMs: number): void {
    if (this.held && nowMs - this.pressedAt >= HOLD_DELAY_MS) this.aim(false);
  }

  private aim(force: boolean): void {
    if (!this.project(this.clientX, this.clientY, this.ground)) return;
    const { x, y } = this.ground;
    if (!force && Math.hypot(x - this.lastX, y - this.lastY) < MIN_REAIM_TILES) return;
    this.lastX = x;
    this.lastY = y;
    this.sink.setMoveTarget(x, y);
  }
}
