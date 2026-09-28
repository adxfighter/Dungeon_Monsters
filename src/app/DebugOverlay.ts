import type { RenderStats } from '@render/Renderer';

/** Overlay refresh interval, seconds (DOM writes are not free on mobile). */
const REFRESH_S = 0.25;

/** Dev-only stats overlay (`?debug=1`). Not player-facing, so not localized. */
export class DebugOverlay {
  private readonly element: HTMLElement;
  private sinceRefresh = REFRESH_S;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('pre');
    this.element.className = 'debug-overlay';
    this.element.setAttribute('data-testid', 'debug-overlay');
    parent.appendChild(this.element);
  }

  update(dtSeconds: number, fps: number, stats: RenderStats): void {
    this.sinceRefresh += dtSeconds;
    if (this.sinceRefresh < REFRESH_S) return;
    this.sinceRefresh = 0;
    this.element.textContent = [
      `FPS   ${fps.toFixed(0)}`,
      `calls ${stats.drawCalls}`,
      `tris  ${stats.triangles}`,
      `geo   ${stats.geometries}  tex ${stats.textures}`,
      `dpr   ${stats.devicePixelRatio.toFixed(2)}  pr ${stats.pixelRatio.toFixed(2)}`,
      `size  ${stats.width}×${stats.height}`,
    ].join('\n');
  }

  dispose(): void {
    this.element.remove();
  }
}
