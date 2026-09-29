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
  },
} as const;
