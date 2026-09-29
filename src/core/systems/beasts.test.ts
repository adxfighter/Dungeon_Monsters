import { describe, expect, it } from 'vitest';
import { tavi } from '@content/characters/tavi';
import { monsters } from '@content/index';
import {
  decapus as gameDecapus,
  dinostrich as gameDino,
  skunk as gameSkunk,
  yak as gameYak,
} from '@content/monsters/newcomers';
import type { MonsterDef } from '@content/schemas';
import { Buttons, createInputState } from '@shared/input';
import { Attacker, Brain, Hazard, Health, Status, Transform } from '../components';
import { Game } from '../Game';
import type { GameEvent } from '../state/events';
import {
  charger as yak,
  grabber as decapus,
  sprayer as skunk,
  twoMoves as dinostrich,
} from '../testing/monsters';

const DT = 1 / 30;
const room = {
  id: 'beasts',
  rows: [
    '#############',
    '#...........#',
    '#...........#',
    '#...........#',
    '#.....P.....#',
    '#...........#',
    '#...........#',
    '#...........#',
    '#############',
  ],
};

function setup(seed = 5) {
  const game = new Game({ room, player: tavi, monsters, seed });
  const input = createInputState();
  const events: GameEvent[] = [];
  const w = game.world;
  w.require(game.player, Health).hp = 1e6; // survive long enough to watch the mechanic
  const run = (steps: number, each?: (i: number) => void) => {
    for (let i = 0; i < steps; i++) {
      each?.(i);
      game.step(input, DT);
      input.buttons = 0;
      events.push(...game.drainEvents());
    }
  };
  const hero = () => w.require(game.player, Transform);
  return { game, input, events, run, w, hero };
}

/** Steps until the monster starts its windup (max `limit` steps). */
function untilWindup(s: ReturnType<typeof setup>, e: number, limit = 300): void {
  for (let i = 0; i < limit && !s.w.require(e, Attacker).current; i++) s.run(1);
  expect(s.w.require(e, Attacker).current?.phase).toBe('windup');
}

describe('stink skunk', () => {
  it('turns its back to spray, and the spray leaves a cloud that slows and hurts over time', () => {
    const s = setup();
    const e = s.game.spawnMonster(skunk, 6.5, 6.1); // 1.6 tiles below the hero
    untilWindup(s, e);
    const t = s.w.require(e, Transform);
    const h = s.hero();
    // Facing (sin rot, cos rot) points away from the hero.
    const away = Math.sin(t.rot) * (h.x - t.x) + Math.cos(t.rot) * (h.y - t.y);
    expect(away).toBeLessThan(0);

    const spray = skunk.attacks[0];
    s.run(Math.ceil(((spray?.windup ?? 0) + 0.05) / DT));
    const clouds = s.w.query(Hazard, Transform);
    expect(clouds.length).toBe(1);
    const cloud = s.w.require(clouds[0] ?? -1, Transform);
    // The cloud lies between the skunk and the hero (toward the target, not behind the skunk).
    expect(cloud.y).toBeLessThan(t.y);

    // Park the hero in the cloud: slowed, and DoT ticks come as `dot` damage.
    h.x = cloud.x;
    h.y = cloud.y;
    const hpBefore = s.w.require(s.game.player, Health).hp;
    s.events.length = 0;
    // The spray hit itself grants after-hit i-frames (they skip ticks), so watch a little longer.
    s.run(Math.round(2 / DT), () => {
      h.x = cloud.x;
      h.y = cloud.y;
    });
    const status = s.w.require(s.game.player, Status);
    expect(status.slowT).toBeGreaterThan(0);
    expect(status.slowMult).toBeCloseTo(spray?.hazard?.slow ?? -1);
    const dots = s.events.filter((ev) => ev.type === 'DamageDealt' && ev.dot && ev.target === s.game.player);
    expect(dots.length).toBeGreaterThanOrEqual(2);
    expect(s.w.require(s.game.player, Health).hp).toBeLessThan(hpBefore);
  });

  it('the cloud fades after its duration', () => {
    const s = setup();
    const e = s.game.spawnMonster(skunk, 6.5, 6.1);
    untilWindup(s, e);
    s.run(Math.ceil(((skunk.attacks[0]?.windup ?? 0) + 0.05) / DT));
    expect(s.w.query(Hazard).length).toBe(1);
    s.w.destroy(e); // no second spray
    s.run(Math.ceil(((skunk.attacks[0]?.hazard?.duration ?? 0) + 0.1) / DT));
    expect(s.w.query(Hazard).length).toBe(0);
  });

  it('a slowed hero walks slower', () => {
    const fast = setup();
    const slow = setup();
    slow.w.require(slow.game.player, Status).slowMult = 0.5;
    for (const s of [fast, slow]) s.input.move.x = 1;
    fast.run(20);
    slow.run(20, () => {
      slow.w.require(slow.game.player, Status).slowT = 1;
    });
    expect(slow.hero().x - 6.5).toBeLessThan((fast.hero().x - 6.5) * 0.7);
  });
});

describe('decapus', () => {
  const grabTime = decapus.attacks[0]?.grab?.duration ?? 0;

  function grabbed(mash: boolean) {
    const s = setup();
    const e = s.game.spawnMonster(decapus, 6.5, 5.9);
    let heldAt = -1;
    let releasedAt = -1;
    s.run(Math.round(8 / DT), (i) => {
      const st = s.w.require(s.game.player, Status);
      if (heldAt < 0 && st.heldBy === e) heldAt = i;
      if (heldAt >= 0 && releasedAt < 0 && st.heldBy < 0) releasedAt = i;
      if (mash && st.heldBy >= 0 && i % 3 === 0) s.input.buttons = Buttons.Attack;
    });
    return { s, e, heldAt, releasedAt };
  }

  it('grabs the hero: no damage, she cannot move, and it lets go after the hold time', () => {
    const { s, e, heldAt, releasedAt } = grabbed(false);
    expect(heldAt).toBeGreaterThan(0);
    expect(s.events.some((ev) => ev.type === 'Grabbed' && ev.by === e)).toBe(true);
    expect(s.events.some((ev) => ev.type === 'DamageDealt' && ev.source === e && ev.amount > 0)).toBe(false);
    expect(releasedAt - heldAt).toBeGreaterThanOrEqual(Math.floor(grabTime / DT) - 1);
    expect(s.events.some((ev) => ev.type === 'GrabReleased')).toBe(true);
  });

  it('while held, walking input is ignored and the decapus stays in its hold', () => {
    const s = setup();
    const e = s.game.spawnMonster(decapus, 6.5, 5.9);
    for (let i = 0; i < 300 && s.w.require(s.game.player, Status).heldBy < 0; i++) s.run(1);
    expect(s.w.require(s.game.player, Status).heldBy).toBe(e);
    const x0 = s.hero().x;
    s.input.move.x = 1;
    s.run(30); // the swing's recovery ends, then it holds
    expect(Math.abs(s.hero().x - x0)).toBeLessThan(0.02);
    expect(s.w.require(e, Brain).state).toBe('hold');
  });

  it('mashing Attack breaks free sooner', () => {
    const idle = grabbed(false);
    const mashed = grabbed(true);
    expect(mashed.releasedAt - mashed.heldAt).toBeLessThan((idle.releasedAt - idle.heldAt) * 0.6);
  });

  it('after-hit i-frames do not stop a grab, but a dodge does', () => {
    const hit = setup();
    const e1 = hit.game.spawnMonster(decapus, 6.5, 5.9);
    untilWindup(hit, e1);
    hit.run(Math.round((decapus.attacks[0]?.windup ?? 0) / DT) - 2);
    hit.w.require(hit.game.player, Health).iFrames = 1; // just got hit by someone else
    hit.run(10);
    expect(hit.w.require(hit.game.player, Status).heldBy).toBe(e1);

    const dodged = setup();
    const e2 = dodged.game.spawnMonster(decapus, 6.5, 5.9);
    untilWindup(dodged, e2);
    dodged.run(Math.round((decapus.attacks[0]?.windup ?? 0) / DT) - 3);
    dodged.input.buttons = Buttons.Dodge; // dash in place of the lash: i-frames through the whole active phase
    dodged.input.move.x = 0.001;
    dodged.run(1);
    dodged.input.move.x = 0;
    for (let i = 0; i < 12; i++) {
      expect(dodged.w.require(dodged.game.player, Status).heldBy).toBe(-1);
      dodged.run(1);
    }
  });

  it('staggering the decapus releases the hero', () => {
    const s = setup();
    const e = s.game.spawnMonster(decapus, 6.5, 5.9);
    for (let i = 0; i < 300 && s.w.require(s.game.player, Status).heldBy < 0; i++) s.run(1);
    s.w.require(e, Health).stagger = 1;
    s.run(1);
    expect(s.w.require(s.game.player, Status).heldBy).toBe(-1);
  });
});

describe('dino-ostrich', () => {
  it('uses both moves — the bite from a little further, the stomp up close', () => {
    const s = setup(7);
    const e = s.game.spawnMonster(dinostrich, 6.5, 5.5);
    s.run(Math.round(25 / DT), (i) => {
      // Vary the distance: step back now and then so the bite range comes into play.
      if (i % 90 === 0) {
        s.hero().x = 6.5 + ((i / 90) % 2 === 0 ? 1.3 : 0.6);
        s.hero().y = 4.5;
      }
    });
    const used = new Set(
      s.events.flatMap((ev) => (ev.type === 'AttackStarted' && ev.entity === e ? [ev.attackId] : [])),
    );
    expect(used).toEqual(new Set(['twomoves.bite', 'twomoves.stomp']));
  });
});

describe('maniac yak', () => {
  it('charges a long way in a line and is dazed after a miss', () => {
    const s = setup();
    const e = s.game.spawnMonster(yak, 6.5, 7.4); // 2.9 tiles below the hero
    untilWindup(s, e);
    const charge = yak.attacks[0];
    s.hero().x = 11.5; // sidestep: the charge misses
    s.run(Math.ceil((charge?.windup ?? 0) / DT) + 1);
    const start = { ...s.w.require(e, Transform) };
    s.run(Math.ceil((charge?.active ?? 0) / DT));
    const end = s.w.require(e, Transform);
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeGreaterThan(2);
    const cur = s.w.require(e, Attacker).current;
    expect(cur?.phase).toBe('recovery');
    expect(cur?.extraRecovery).toBe(charge?.missRecovery);
  });
});

describe('new-monster data', () => {
  it('only the grab has zero power, and every hazard is laid by a hit that points at the target', () => {
    const defs: MonsterDef[] = [gameSkunk, gameYak, gameDino, gameDecapus];
    for (const d of defs) {
      for (const a of d.attacks) {
        if (a.power === 0) expect(a.grab).toBeDefined();
        if (a.hazard) expect(a.shape).toBeDefined();
      }
    }
  });
});
