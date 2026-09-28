/**
 * Seedable deterministic PRNG (sfc32, seeded through splitmix32).
 * The only source of randomness allowed in core (ARCHITECTURE §3).
 */

/** Serializable generator state (for saves / replays). The seed is kept so forks survive a restore. */
export interface RngState {
  readonly seed: number;
  readonly words: readonly [number, number, number, number];
}

const isUint32 = (value: number): boolean => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;

/** 32-bit FNV-1a hash of a string. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** splitmix32 finalizer: good avalanche for turning structured seeds into state words. */
function mix32(value: number): number {
  let z = value >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return (z ^ (z >>> 16)) >>> 0;
}

const GOLDEN = 0x9e3779b9;

export class Rng {
  private seedValue: number;
  private a = 0;
  private b = 0;
  private c = 0;
  private d = 0;

  constructor(seed: number | string) {
    this.seedValue = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    let s = this.seedValue;
    this.a = mix32((s = (s + GOLDEN) >>> 0));
    this.b = mix32((s = (s + GOLDEN) >>> 0));
    this.c = mix32((s = (s + GOLDEN) >>> 0));
    this.d = mix32((s + GOLDEN) >>> 0);
    // Warm up to decorrelate nearby seeds.
    for (let i = 0; i < 12; i++) this.nextUint32();
  }

  /** Restores a generator saved with `getState()`, including its fork streams. */
  static fromState(state: RngState): Rng {
    const rng = new Rng(0);
    rng.setState(state);
    return rng;
  }

  /** Seed this generator was created from; forks derive from it, not from the current state. */
  get seed(): number {
    return this.seedValue;
  }

  /** Next unsigned 32-bit integer (sfc32). */
  nextUint32(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = (this.b ^ (this.b >>> 9)) >>> 0;
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t;
  }

  /** Float in [0, 1). */
  float(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.float();
  }

  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Rng.int: invalid range [${min}, ${max}]`);
    }
    return min + Math.floor(this.float() * (max - min + 1));
  }

  /** True with probability p (p <= 0 never, p >= 1 always). */
  chance(p: number): boolean {
    return this.float() < p;
  }

  /** Uniformly picks an element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('Rng.pick: empty array');
    return items[this.int(0, items.length - 1)] as T;
  }

  /**
   * Independent child stream identified by `label` (e.g. 'loot', 'floor:3').
   * Depends only on this generator's seed and the label, so the order in which
   * streams are forked or consumed never changes their sequences.
   */
  fork(label: string): Rng {
    return new Rng(mix32(this.seed ^ mix32(hashString(label) + GOLDEN)));
  }

  getState(): RngState {
    return { seed: this.seedValue, words: [this.a, this.b, this.c, this.d] };
  }

  /** Replaces seed and stream position. Throws if any value is not a uint32 (corrupt save). */
  setState(state: RngState): void {
    if (!isUint32(state.seed) || state.words.length !== 4 || !state.words.every(isUint32)) {
      throw new RangeError('Rng.setState: state must contain uint32 values');
    }
    this.seedValue = state.seed;
    [this.a, this.b, this.c, this.d] = state.words;
  }
}
