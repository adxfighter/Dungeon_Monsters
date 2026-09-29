import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@core/state/events';
import { CombatFeedback, FEEL, type FeedbackSinks } from './CombatFeedback';

const HERO = 1;
const MOB = 2;

function setup() {
  const log: string[] = [];
  const sinks: FeedbackSinks = {
    hitStop: (s) => log.push(`stop ${s}`),
    shake: (a) => log.push(`shake ${a}`),
    vibrate: (ms) => log.push(`vibrate ${ms}`),
    number: (_x, _h, _y, text, kind) => log.push(`number ${text} ${kind}`),
  };
  return { log, fb: new CombatFeedback(HERO, sinks, 'Блок!') };
}

const hit = (patch: Partial<Extract<GameEvent, { type: 'DamageDealt' }>>): GameEvent => ({
  type: 'DamageDealt',
  source: HERO,
  target: MOB,
  amount: 10,
  element: 'slash',
  crit: false,
  blocked: false,
  backstab: false,
  staggered: false,
  x: 0,
  y: 0,
  ...patch,
});

describe('CombatFeedback', () => {
  it('hero landing a hit: number, 60 ms hit-stop, light shake, short vibration', () => {
    const { log, fb } = setup();
    fb.handle([hit({})]);
    expect(log).toEqual([
      'number 10 dealt',
      `stop ${FEEL.hitStop}`,
      `shake ${FEEL.shakeDealt[0]}`,
      `vibrate ${FEEL.vibrateDealt}`,
    ]);
    expect(FEEL.hitStop).toBe(0.06);
  });

  it('crits and staggers hit harder', () => {
    const { log, fb } = setup();
    fb.handle([hit({ crit: true })]);
    expect(log).toContain('number 10 crit');
    expect(log).toContain(`stop ${FEEL.heavyHitStop}`);
    expect(log).toContain(`shake ${FEEL.shakeHeavy[0]}`);
  });

  it('the hero taking a hit: red number, strong shake and vibration', () => {
    const { log, fb } = setup();
    fb.handle([hit({ source: MOB, target: HERO, amount: 7 })]);
    expect(log).toEqual([
      'number 7 taken',
      `stop ${FEEL.heavyHitStop}`,
      `shake ${FEEL.shakeTaken[0]}`,
      `vibrate ${FEEL.vibrateTaken}`,
    ]);
  });

  it('blocked hits show the block label without hit-stop', () => {
    const { log, fb } = setup();
    fb.handle([hit({ blocked: true, amount: 0 })]);
    expect(log[0]).toBe('number Блок! blocked');
    expect(log.some((l) => l.startsWith('stop'))).toBe(false);
  });

  it('kills add a heavy stop; unrelated events are ignored', () => {
    const { log, fb } = setup();
    fb.handle([
      {
        type: 'MonsterKilled',
        entity: MOB,
        monsterId: 'bubbler',
        killElement: 'slash',
        overkill: 2,
        hitsTaken: 3,
        x: 0,
        y: 0,
      },
      { type: 'WaveStarted', index: 1, total: 3 },
    ]);
    expect(log).toEqual([
      `stop ${FEEL.heavyHitStop}`,
      `shake ${FEEL.shakeKill[0]}`,
      `vibrate ${FEEL.vibrateKill}`,
    ]);
  });
});
