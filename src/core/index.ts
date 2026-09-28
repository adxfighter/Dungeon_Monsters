// core — pure, deterministic game logic. No three/preact/DOM/Math.random/Date.now (ARCHITECTURE §3).
export { Rng, hashString, type RngState } from './rng';
export { FixedClock, SIM_HZ, type FixedClockOptions } from './clock';
