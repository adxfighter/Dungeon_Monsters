import './overlay.css';

/** Projects a world point (x, height, y) to client CSS pixels; false if off screen / behind the camera. */
export type ClientProjector = (
  x: number,
  height: number,
  y: number,
  out: { x: number; y: number },
) => boolean;

export type NumberKind = 'dealt' | 'crit' | 'taken' | 'blocked';

const BAR_POOL = 12;
const NUMBER_POOL = 24;
/** Seconds a damage number is visible. */
const NUMBER_LIFE = 0.75;
/** Rise over its life, CSS px. */
const NUMBER_RISE = 42;

interface FloatingNumber {
  el: HTMLSpanElement;
  x: number;
  y: number;
  height: number;
  t: number;
  jitter: number;
}

/**
 * World-anchored overlay (M2): enemy HP bars and floating damage numbers as pooled DOM nodes positioned with
 * `transform` every frame. Imperative on purpose — no Preact re-render per frame, nothing allocated per hit.
 */
export class WorldOverlay {
  private readonly root: HTMLDivElement;
  /** Last written pixel position / percentage per bar: styles are rewritten only when they change. */
  private readonly bars: {
    el: HTMLDivElement;
    fill: HTMLDivElement;
    x: number;
    y: number;
    pct: number;
    shown: boolean;
  }[] = [];
  private barsUsed = 0;
  private readonly numbers: FloatingNumber[] = [];
  private nextNumber = 0;
  private readonly p = { x: 0, y: 0 };

  /** Inserted into `parent` before `before` (e.g. under the HUD layer). */
  constructor(parent: HTMLElement, before: Element | null = null) {
    this.root = document.createElement('div');
    this.root.className = 'world-overlay';
    parent.insertBefore(this.root, before);
    for (let i = 0; i < BAR_POOL; i++) {
      const el = document.createElement('div');
      el.className = 'enemy-hp';
      el.setAttribute('data-testid', 'enemy-hp');
      const fill = document.createElement('div');
      fill.className = 'enemy-hp-fill';
      el.appendChild(fill);
      el.style.display = 'none';
      this.root.appendChild(el);
      this.bars.push({ el, fill, x: NaN, y: NaN, pct: NaN, shown: false });
    }
    for (let i = 0; i < NUMBER_POOL; i++) {
      const el = document.createElement('span');
      el.className = 'dmg';
      el.setAttribute('data-testid', 'damage-number');
      el.style.display = 'none';
      this.root.appendChild(el);
      this.numbers.push({ el, x: 0, y: 0, height: 0, t: 0, jitter: 0 });
    }
  }

  /** Start of the HP-bar pass for this frame. */
  beginBars(): void {
    this.barsUsed = 0;
  }

  /** Places one enemy HP bar above world point (x, height, y). Writes DOM only when something changed. */
  bar(x: number, height: number, y: number, fraction: number, project: ClientProjector): void {
    const slot = this.bars[this.barsUsed];
    if (!slot || !project(x, height, y, this.p)) return;
    this.barsUsed++;
    if (!slot.shown) {
      slot.el.style.display = '';
      slot.shown = true;
    }
    const px = Math.round(this.p.x);
    const py = Math.round(this.p.y);
    if (px !== slot.x || py !== slot.y) {
      slot.x = px;
      slot.y = py;
      slot.el.style.transform = `translate(${px}px, ${py}px)`;
    }
    const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    if (pct !== slot.pct) {
      slot.pct = pct;
      slot.fill.style.width = `${pct}%`;
    }
  }

  /** Hides bars not placed this frame. */
  endBars(): void {
    for (let i = this.barsUsed; i < this.bars.length; i++) {
      const slot = this.bars[i];
      if (slot?.shown) {
        slot.el.style.display = 'none';
        slot.shown = false;
      }
    }
  }

  /** Pops a damage number at world point (x, height, y); the oldest is recycled when the pool is full. */
  number(x: number, height: number, y: number, text: string, kind: NumberKind): void {
    const n = this.numbers[this.nextNumber];
    if (!n) return;
    this.nextNumber = (this.nextNumber + 1) % this.numbers.length;
    n.x = x;
    n.y = y;
    n.height = height;
    n.t = NUMBER_LIFE;
    n.jitter = (this.nextNumber % 5) * 6 - 12; // deterministic spread, no Math.random needed
    n.el.textContent = text;
    n.el.className = `dmg dmg-${kind}`;
    n.el.style.display = '';
  }

  /** Moves live numbers (rise + fade), anchored to their world point. */
  updateNumbers(dtSeconds: number, project: ClientProjector): void {
    for (const n of this.numbers) {
      if (n.t <= 0) continue;
      n.t -= dtSeconds;
      if (n.t <= 0 || !project(n.x, n.height, n.y, this.p)) {
        n.el.style.display = 'none';
        n.t = 0;
        continue;
      }
      const k = 1 - n.t / NUMBER_LIFE;
      const px = this.p.x + n.jitter;
      const py = this.p.y - k * NUMBER_RISE;
      n.el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) scale(${(1.25 - 0.25 * k).toFixed(2)})`;
      n.el.style.opacity = (k < 0.7 ? 1 : (1 - k) / 0.3).toFixed(2);
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
