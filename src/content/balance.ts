/**
 * Global combat balance (CLAUDE.md §3: no balance numbers in system code).
 * Per-character / per-monster numbers live in their own content files.
 */
export const BALANCE = {
  damage: {
    /** damage = ATK · power · K / (K + DEF): each K points of DEF halves damage. */
    defenseK: 10,
    /** ± fraction of random spread on every hit. */
    variance: 0.1,
    critChance: 0.08,
    critMult: 1.5,
    /** Every landed hit does at least this much (unless the target is immune to the element). */
    minDamage: 1,
  },
  /** Hero auto-aim when an attack starts (GDD §4.1: cone 60°, nearest). */
  autoAim: {
    coneDeg: 60,
    /** tiles */
    range: 2.4,
  },
  /** Seconds a staggered target can't act. */
  staggerTime: 0.45,
  /** Poise regenerates fully after this many seconds without poise damage. */
  poiseResetTime: 2,
  /** Seconds a carcass stays on the floor (scavengers eat it; M3 butchers it). */
  carrionTtl: 25,
  /** Loot and butchery (M3). */
  loot: {
    /** The Action button appears within this distance of a carcass, tiles. */
    reach: 1.2,
    /** Overkill above this fraction of max HP mangles the carcass: −1 star. */
    overkillRatio: 0.5,
  },
  /** Butchery mini-game scoring (GDD §4.4), board units (0..1). */
  butchery: {
    /** Mean stroke distance from the line that scores zero accuracy. */
    tolerance: 0.12,
    star3: { accuracy: 0.72, coverage: 0.8 },
    star2: { accuracy: 0.4, coverage: 0.5 },
    /** A stroke slower than this (seconds) can't get ★3. */
    slowStroke: 1.5,
    /** Simplified mode: a tap this close to the next dot counts. */
    tapRadius: 0.09,
    /** Simplified mode: misses allowed on one line (★2); one more ends it at ★1. */
    tapMisses: 2,
  },
  /** The hero's backpack limits (M3). */
  backpack: { maxWeight: 30, maxSlots: 12 },
  /** A hazard's slow lingers this long after stepping out, seconds. */
  hazardSlowLinger: 0.3,
  /** Monster AI tuning shared by all monsters (per-monster numbers live in MonsterDef.ai). */
  ai: {
    /** Chasers stop closing in at this fraction of their attack range. */
    closeIn: 0.7,
    /** A wander leg is abandoned after this long, seconds (stuck on a wall). */
    wanderTimeout: 4,
    /** Distance (tiles) at which a wander point counts as reached. */
    wanderReached: 0.2,
    /** Random points tried per wander pick. */
    wanderTries: 4,
    /** A scavenger this close (tiles) to its carcass starts eating. */
    eatReach: 0.45,
    /** A scavenger gives up eating and fights if the hero comes this close (tiles). */
    eatDisturb: 1,
  },
} as const;
