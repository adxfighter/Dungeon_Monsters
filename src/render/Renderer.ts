import { type Camera, type Scene, SRGBColorSpace, WebGLRenderer } from 'three';

/** Upper bound for the render pixel ratio (ARCHITECTURE §7, §10). */
export const MAX_PIXEL_RATIO = 2;
/** Lower bound the adaptive resolution may fall to. */
export const MIN_PIXEL_RATIO = 1;

export interface RendererOptions {
  /** Fixed pixel ratio (e.g. `?pr=1` GPU proxy); disables adaptive scaling. */
  forcedPixelRatio?: number;
}

/** Frame statistics for the dev overlay. */
export interface RenderStats {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  pixelRatio: number;
  devicePixelRatio: number;
  width: number;
  height: number;
}

/** FPS under which the adaptive resolution steps down. */
const ADAPT_LOW_FPS = 45;
/** Seconds of sustained low FPS before a step down. */
const ADAPT_WINDOW_S = 2;
const ADAPT_STEP = 0.25;

/**
 * Owns the WebGL2 context: sizing, pixel ratio and render calls.
 * Adaptive resolution only ever lowers the pixel ratio (no oscillation); quality profiles come later.
 */
export class Renderer {
  readonly three: WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly forcedPixelRatio: number | undefined;
  private pixelRatio: number;
  private lowFpsTime = 0;
  private readonly resizeObserver: ResizeObserver;
  private width = 1;
  private height = 1;
  private onResize: ((width: number, height: number) => void) | undefined;

  constructor(canvas: HTMLCanvasElement, options: RendererOptions = {}) {
    this.canvas = canvas;
    this.three = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.three.outputColorSpace = SRGBColorSpace;
    this.forcedPixelRatio = options.forcedPixelRatio;
    this.pixelRatio = this.forcedPixelRatio ?? Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    this.three.setPixelRatio(this.pixelRatio);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  /** Called with the new CSS size whenever the canvas is resized. */
  setResizeHandler(handler: (width: number, height: number) => void): void {
    this.onResize = handler;
    handler(this.width, this.height);
  }

  resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.three.setSize(width, height, false);
    this.onResize?.(width, height);
  }

  /** Feeds the smoothed FPS; lowers the pixel ratio after sustained low FPS. */
  adapt(fps: number, dtSeconds: number): void {
    if (this.forcedPixelRatio !== undefined || this.pixelRatio <= MIN_PIXEL_RATIO) return;
    // 0 = not measured yet (hidden tab, only pause-length frames) — not evidence of a slow GPU.
    if (!(fps > 0)) return;
    this.lowFpsTime = fps < ADAPT_LOW_FPS ? this.lowFpsTime + dtSeconds : 0;
    if (this.lowFpsTime < ADAPT_WINDOW_S) return;
    this.lowFpsTime = 0;
    this.pixelRatio = Math.max(MIN_PIXEL_RATIO, this.pixelRatio - ADAPT_STEP);
    this.three.setPixelRatio(this.pixelRatio);
    this.three.setSize(this.width, this.height, false);
  }

  render(scene: Scene, camera: Camera): void {
    this.three.render(scene, camera);
  }

  stats(): RenderStats {
    const { render, memory } = this.three.info;
    return {
      drawCalls: render.calls,
      triangles: render.triangles,
      geometries: memory.geometries,
      textures: memory.textures,
      pixelRatio: this.pixelRatio,
      devicePixelRatio: window.devicePixelRatio || 1,
      width: this.width,
      height: this.height,
    };
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.onResize = undefined;
    this.three.dispose();
  }
}
