import { resolveCircleVsTiles } from '../systems/collision';
import type { TileMap } from './TileMap';

export interface Point {
  x: number;
  y: number;
}

const SQRT2 = Math.SQRT2;
/** Neighbour offsets: 4 orthogonal, then 4 diagonal (fixed order → deterministic ties). */
const DIRS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];
/** Sampling step (tiles) when checking that a straight segment is walkable. */
const SWEEP_STEP = 0.1;

/** Octile distance — admissible heuristic for 8-way movement. */
function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * Nearest walkable tile to (x, y) within `maxRadius` rings (Chebyshev), preferring the closest centre;
 * equal distances are broken toward `prefer` (e.g. the walker, so a tap on a wall picks its near side).
 */
export function nearestFloorTile(
  map: TileMap,
  x: number,
  y: number,
  maxRadius = 3,
  prefer?: Point,
): Point | null {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (!map.isSolid(tx, ty)) return { x: tx, y: ty };
  for (let r = 1; r <= maxRadius; r++) {
    let best: Point | null = null;
    let bestDist = Infinity;
    let bestPrefer = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const cx = tx + dx;
        const cy = ty + dy;
        if (map.isSolid(cx, cy)) continue;
        const d = (cx + 0.5 - x) ** 2 + (cy + 0.5 - y) ** 2;
        const dp = prefer ? (cx + 0.5 - prefer.x) ** 2 + (cy + 0.5 - prefer.y) ** 2 : 0;
        if (d < bestDist - 1e-9 || (Math.abs(d - bestDist) <= 1e-9 && dp < bestPrefer)) {
          bestDist = d;
          bestPrefer = dp;
          best = { x: cx, y: cy };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** True if a circle of `radius` can travel from a to b in a straight line without touching solid tiles. */
export function segmentClear(map: TileMap, a: Point, b: Point, radius: number): boolean {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(len / SWEEP_STEP));
  const r2 = radius * radius;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    for (let ty = Math.floor(y - radius); ty <= Math.floor(y + radius); ty++) {
      for (let tx = Math.floor(x - radius); tx <= Math.floor(x + radius); tx++) {
        if (!map.isSolid(tx, ty)) continue;
        const cx = Math.min(Math.max(x, tx), tx + 1);
        const cy = Math.min(Math.max(y, ty), ty + 1);
        if ((x - cx) ** 2 + (y - cy) ** 2 < r2) return false;
      }
    }
  }
  return true;
}

interface SearchBuffers {
  g: Float64Array;
  f: Float64Array;
  h: Float64Array;
  parent: Int32Array;
  closed: Uint8Array;
}

let buffers: SearchBuffers | undefined;

/** Reused per-map-size search arrays (replanning happens often while a finger drags), reset per call. */
function searchBuffers(n: number): SearchBuffers {
  if (!buffers || buffers.g.length !== n) {
    buffers = {
      g: new Float64Array(n),
      f: new Float64Array(n),
      h: new Float64Array(n),
      parent: new Int32Array(n),
      closed: new Uint8Array(n),
    };
  }
  buffers.g.fill(Infinity);
  buffers.f.fill(Infinity);
  buffers.h.fill(0);
  buffers.parent.fill(-1);
  buffers.closed.fill(0);
  return buffers;
}

/** Binary min-heap of node indices keyed by (f, h, index) — full ordering keeps A* deterministic. */
class NodeHeap {
  private readonly items: number[] = [];
  private readonly f: Float64Array;
  private readonly h: Float64Array;

  constructor(f: Float64Array, h: Float64Array) {
    this.f = f;
    this.h = h;
  }

  get size(): number {
    return this.items.length;
  }

  private less(a: number, b: number): boolean {
    const fa = this.f[a] ?? 0;
    const fb = this.f[b] ?? 0;
    if (fa !== fb) return fa < fb;
    const ha = this.h[a] ?? 0;
    const hb = this.h[b] ?? 0;
    if (ha !== hb) return ha < hb;
    return a < b;
  }

  push(node: number): void {
    const items = this.items;
    items.push(node);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const p = items[parent] as number;
      if (!this.less(node, p)) break;
      items[i] = p;
      i = parent;
    }
    items[i] = node;
  }

  pop(): number {
    const items = this.items;
    const top = items[0] as number;
    const last = items.pop() as number;
    if (items.length > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = last;
        let si = -1;
        const li = items[l];
        if (li !== undefined && this.less(li, smallest)) {
          smallest = li;
          si = l;
        }
        const ri = items[r];
        if (ri !== undefined && this.less(ri, smallest)) {
          smallest = ri;
          si = r;
        }
        if (si < 0) break;
        items[i] = smallest;
        i = si;
      }
      items[i] = last;
    }
    return top;
  }
}

/**
 * A* over the tile grid (8-way, no corner cutting), then string-pulled so the circle walks straight lines
 * where it can. Returns waypoints in simulation space ending exactly at `goal`
 * (or at the centre of the nearest floor tile if `goal` is inside a wall), without the start point.
 * Returns null if the goal is unreachable. An empty array means "already there".
 */
export function findPath(map: TileMap, start: Point, goal: Point, radius: number): Point[] | null {
  const startTile = nearestFloorTile(map, start.x, start.y, 1);
  const goalTile = nearestFloorTile(map, goal.x, goal.y, 3, start);
  if (!startTile || !goalTile) return null;
  const goalInWall = map.isSolid(Math.floor(goal.x), Math.floor(goal.y));
  const endCircle = goalInWall
    ? { x: goalTile.x + 0.5, y: goalTile.y + 0.5, radius }
    : { x: goal.x, y: goal.y, radius };
  // A point closer than `radius` to a wall can never be reached by the circle's centre: pull it out,
  // otherwise the walker would push into the wall forever without arriving.
  resolveCircleVsTiles(map, endCircle);
  const end: Point = { x: endCircle.x, y: endCircle.y };

  if (segmentClear(map, start, end, radius)) {
    return Math.hypot(end.x - start.x, end.y - start.y) < 1e-6 ? [] : [end];
  }

  const w = map.width;
  const { g, f, h, parent, closed } = searchBuffers(w * map.height);
  const heap = new NodeHeap(f, h);
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < map.height;

  const s = startTile.y * w + startTile.x;
  const target = goalTile.y * w + goalTile.x;
  g[s] = 0;
  h[s] = octile(startTile.x, startTile.y, goalTile.x, goalTile.y);
  f[s] = h[s] ?? 0;
  heap.push(s);

  let found = false;
  while (heap.size > 0) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === target) {
      found = true;
      break;
    }
    const cx = cur % w;
    const cy = (cur - cx) / w;
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inside(nx, ny) || map.isSolid(nx, ny)) continue;
      // No corner cutting: a diagonal step needs both orthogonal neighbours open.
      if (dx !== 0 && dy !== 0 && (map.isSolid(cx + dx, cy) || map.isSolid(cx, cy + dy))) continue;
      const ni = ny * w + nx;
      if (closed[ni]) continue;
      const ng = (g[cur] ?? 0) + cost;
      if (ng < (g[ni] ?? Infinity)) {
        g[ni] = ng;
        const hn = octile(nx, ny, goalTile.x, goalTile.y);
        h[ni] = hn;
        f[ni] = ng + hn;
        parent[ni] = cur;
        heap.push(ni);
      }
    }
  }
  if (!found) return null;

  // Tile chain start → goal (tile centres), with the exact end point last.
  const chain: Point[] = [];
  for (let i = target; i !== s && i >= 0; i = parent[i] ?? -1) {
    chain.push({ x: (i % w) + 0.5, y: Math.floor(i / w) + 0.5 });
  }
  chain.reverse();
  if (chain.length > 0) chain[chain.length - 1] = end;
  else chain.push(end);

  // String pulling: from the current anchor, jump to the farthest waypoint reachable in a straight line.
  const path: Point[] = [];
  let anchor: Point = start;
  let i = 0;
  while (i < chain.length) {
    let far = i;
    for (let j = chain.length - 1; j > i; j--) {
      if (segmentClear(map, anchor, chain[j] as Point, radius)) {
        far = j;
        break;
      }
    }
    const next = chain[far] as Point;
    path.push(next);
    anchor = next;
    i = far + 1;
  }
  return path;
}
