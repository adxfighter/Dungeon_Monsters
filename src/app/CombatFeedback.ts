import type { Entity } from '@core/ecs/World';
import type { GameEvent } from '@core/state/events';

/** Where feedback goes; the app wires these to GameLoop, CameraRig, haptics and the world overlay. */
export interface FeedbackSinks {
  hitStop(seconds: number): void;
  shake(amplitude: number, duration: number): void;
  vibrate(ms: number): void;
  number(
    x: number,
    height: number,
    y: number,
    text: string,
    kind: 'dealt' | 'crit' | 'taken' | 'blocked',
  ): void;
}

/** Game-feel tuning (not game balance): how hard each kind of hit is felt. */
export const FEEL = {
  /** Hit-stop on a landed hit, seconds (M2: 60 ms). */
  hitStop: 0.06,
  /** Longer freeze for crits, staggers and kills. */
  heavyHitStop: 0.09,
  /** Camera shake: [amplitude tiles, duration s]. */
  shakeDealt: [0.04, 0.12],
  shakeHeavy: [0.08, 0.18],
  shakeTaken: [0.14, 0.25],
  shakeKill: [0.1, 0.2],
  /** Vibration, ms. */
  vibrateDealt: 12,
  vibrateTaken: 45,
  vibrateKill: 25,
  /** Damage numbers float up from this height, world units. */
  numberHeight: 1.1,
} as const;

/**
 * Turns core combat events into feedback (M2 readability): hit-stop, camera shake, vibration, floating numbers.
 * Only hits involving the hero shake the camera / vibrate — monsters hitting each other stay quiet.
 */
export class CombatFeedback {
  private readonly hero: Entity;
  private readonly sinks: FeedbackSinks;
  private readonly blockedText: string;

  constructor(hero: Entity, sinks: FeedbackSinks, blockedText: string) {
    this.hero = hero;
    this.sinks = sinks;
    this.blockedText = blockedText;
  }

  handle(events: readonly GameEvent[]): void {
    const s = this.sinks;
    for (const e of events) {
      if (e.type === 'DamageDealt') {
        const heroHit = e.target === this.hero;
        const heroDealt = e.source === this.hero;
        if (e.blocked) {
          s.number(e.x, FEEL.numberHeight, e.y, this.blockedText, 'blocked');
          if (heroDealt) s.shake(FEEL.shakeDealt[0], FEEL.shakeDealt[1]);
          continue;
        }
        s.number(
          e.x,
          FEEL.numberHeight,
          e.y,
          String(e.amount),
          heroHit ? 'taken' : e.crit ? 'crit' : 'dealt',
        );
        if (heroHit) {
          s.hitStop(FEEL.heavyHitStop);
          s.shake(FEEL.shakeTaken[0], FEEL.shakeTaken[1]);
          s.vibrate(FEEL.vibrateTaken);
        } else if (heroDealt) {
          const heavy = e.crit || e.staggered;
          s.hitStop(heavy ? FEEL.heavyHitStop : FEEL.hitStop);
          const [a, d] = heavy ? FEEL.shakeHeavy : FEEL.shakeDealt;
          s.shake(a, d);
          s.vibrate(FEEL.vibrateDealt);
        }
      } else if (e.type === 'MonsterKilled') {
        s.hitStop(FEEL.heavyHitStop);
        s.shake(FEEL.shakeKill[0], FEEL.shakeKill[1]);
        s.vibrate(FEEL.vibrateKill);
      }
    }
  }
}
