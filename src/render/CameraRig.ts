import { PerspectiveCamera, Vector3 } from 'three';

/** Camera elevation above the ground plane (GDD §4.1: isometric from above-behind). */
const PITCH_RAD = (52 * Math.PI) / 180;
/** Narrow lens + long distance ≈ near-isometric look without fisheye on tall portrait screens. */
const V_FOV_DEG = 30;
/** Ground width (tiles) visible across the screen at the focus point, kept on every aspect ratio. */
const VIEW_WIDTH_TILES = 5;
/** Minimum ground height (tiles) visible at the focus, for landscape screens. */
const MIN_VIEW_HEIGHT_TILES = 4;
/** Follow stiffness, 1/s (exponential smoothing, frame-rate independent). */
const FOLLOW_RATE = 7;
/** Look-ahead: seconds of current velocity added to the focus point. */
const LOOK_AHEAD_S = 0.15;
/** How far (tiles) past the room edge the view may reach before the camera stops following. */
const OVERSCAN_TILES = 0.75;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function clampAxis(value: number, min: number, max: number): number {
  // Room narrower than the allowed band: lock to its centre.
  if (min > max) return (min + max) / 2;
  return Math.min(Math.max(value, min), max);
}

/**
 * Fixed-orientation follow camera: looks from +Z (screen bottom) toward -Z at `PITCH_RAD`.
 * Simulation (x, y) maps to world (x, 0, y). Operates on interpolated positions every render frame,
 * so it doesn't inherit the 30 Hz step jitter.
 */
export class CameraRig {
  readonly camera = new PerspectiveCamera(V_FOV_DEG, 1, 1, 120);
  private readonly focus = new Vector3();
  private readonly offset = new Vector3();
  private readonly bounds: Bounds;
  private initialized = false;
  /** Screen shake: remaining time, total time and amplitude (tiles). */
  private shakeT = 0;
  private shakeDuration = 1;
  private shakeAmp = 0;
  /** Player setting (M2: camera shake can be turned off). */
  shakeEnabled = true;
  /** Focus-to-screen-edge distances on the ground, tiles (set by setAspect). */
  private halfViewX = 0;
  private halfViewY = 0;

  constructor(bounds: Bounds) {
    this.bounds = bounds;
  }

  setAspect(width: number, height: number): void {
    const aspect = width / height;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    // Distance so that VIEW_WIDTH_TILES fit horizontally (and MIN_VIEW_HEIGHT_TILES vertically).
    const tanHalfV = Math.tan((V_FOV_DEG * Math.PI) / 360);
    const distance = Math.max(
      VIEW_WIDTH_TILES / (2 * tanHalfV * aspect),
      MIN_VIEW_HEIGHT_TILES / (2 * tanHalfV),
    );
    this.offset.set(0, Math.sin(PITCH_RAD) * distance, Math.cos(PITCH_RAD) * distance);
    // Approximate ground footprint (the view plane is tilted by the pitch, so depth stretches by 1/sin).
    this.halfViewX = distance * tanHalfV * aspect;
    this.halfViewY = (distance * tanHalfV) / Math.sin(PITCH_RAD);
  }

  /** Target position and velocity in simulation space. */
  update(dtSeconds: number, x: number, y: number, vx: number, vy: number): void {
    const b = this.bounds;
    const mx = this.halfViewX - OVERSCAN_TILES;
    const my = this.halfViewY - OVERSCAN_TILES;
    const tx = clampAxis(x + vx * LOOK_AHEAD_S, b.minX + mx, b.maxX - mx);
    const tz = clampAxis(y + vy * LOOK_AHEAD_S, b.minY + my, b.maxY - my);
    if (!this.initialized) {
      this.focus.set(tx, 0, tz);
      this.initialized = true;
    } else {
      const k = 1 - Math.exp(-FOLLOW_RATE * Math.max(0, dtSeconds));
      this.focus.x += (tx - this.focus.x) * k;
      this.focus.z += (tz - this.focus.z) * k;
    }
    this.camera.position.copy(this.focus).add(this.offset);
    this.camera.lookAt(this.focus);
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - Math.max(0, dtSeconds));
      const a = this.shakeAmp * (this.shakeT / this.shakeDuration);
      // Render-only randomness (not core): jitter the camera without moving what it looks at.
      this.camera.position.x += (Math.random() * 2 - 1) * a;
      this.camera.position.y += (Math.random() * 2 - 1) * a * 0.5;
    }
    // lookAt refreshed the matrix before the shake offset: refresh again so world-anchored UI (HP bars,
    // damage numbers) projects with the same camera the scene renders with.
    this.camera.updateMatrixWorld();
  }

  /** Short decaying shake; a stronger request overrides a weaker one in progress. */
  shake(amplitude: number, duration: number): void {
    if (!this.shakeEnabled || duration <= 0) return;
    const current = this.shakeT > 0 ? this.shakeAmp * (this.shakeT / this.shakeDuration) : 0;
    if (amplitude < current) return;
    this.shakeAmp = amplitude;
    this.shakeDuration = duration;
    this.shakeT = duration;
  }
}
