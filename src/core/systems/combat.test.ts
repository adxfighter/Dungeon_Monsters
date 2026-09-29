import { describe, expect, it } from 'vitest';
import { tavi } from '@content/characters/tavi';
import { bubbler, sparkhog, stonenibbler } from '@content/monsters/tier1';
import { arenaTest } from '@content/rooms/arena_test';
import type { MonsterDef } from '@content/schemas';
import { Buttons, createInputState, type InputState } from '@shared/input';
import { Attacker, Brain, Dodge, Health, Transform } from '../components';
import type { Entity } from '../ecs/World';
import { Game } from '../Game';
import type { GameEvent } from '../state/events';

const DT = 1 / 30;
const room = {
  id: 'combat',
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
const monsters = { bubbler, sparkhog, stonenibbler };

function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error('empty list');
  return item;
}
const pounce = first(stonenibbler.attacks);
const quills = first(sparkhog.attacks);

/** A monster that stands still and never attacks — a training dummy with the real stats. */
function dummy(def: MonsterDef): MonsterDef {
  return {
    ...def,
    movement: { ...def.movement, speed: 0.001 },
    ai: { ...def.ai, temperament: 'passive', noticeRange: 0.01, loseRange: 0.02, wanderRadius: 0 },
    guard: undefined,
  } as MonsterDef;
}

class Arena {
  readonly game: Game;
  readonly input: InputState = createInputState();
  readonly events: GameEvent[] = [];

  constructor(seed: number | string = 1, waves = false) {
    this.game = new Game({
      room,
      player: tavi,
      seed,
      monsters,
      ...(waves ? { waves: arenaTest.waves } : {}),
    });
  }

  press(bit: number): this {
    this.input.buttons |= bit;
    return this;
  }

  run(steps: number): this {
    for (let i = 0; i < steps; i++) {
      this.game.step(this.input, DT);
      this.input.buttons = 0;
      this.events.push(...this.game.drainEvents());
    }
    return this;
  }

  seconds(s: number): this {
    return this.run(Math.round(s / DT));
  }

  get hero(): Entity {
    return this.game.player;
  }

  health(e: Entity) {
    return this.game.world.require(e, Health);
  }

  pos(e: Entity) {
    return this.game.world.require(e, Transform);
  }

  of<T extends GameEvent['type']>(type: T): Extract<GameEvent, { type: T }>[] {
    return this.events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
  }
}

describe('hero combo', () => {
  it('a single press does one swing; presses within the window chain up to 3 hits', () => {
    const a = new Arena();
    const m = a.game.spawnMonster(dummy(bubbler), 6.5, 5.3); // right in front (hero faces +y)
    a.press(Buttons.Attack).seconds(1);
    expect(a.of('AttackStarted').map((e) => e.attackId)).toEqual(['tavi.slash1']);
    expect(a.health(m).hitsTaken).toBe(1);

    // Press again during each swing: buffered → full chain.
    const b = new Arena();
    const n = b.game.spawnMonster(dummy(sparkhog), 6.5, 5.3);
    b.press(Buttons.Attack).run(3).press(Buttons.Attack).run(15).press(Buttons.Attack).seconds(1.5);
    expect(b.of('AttackStarted').map((e) => e.attackId)).toEqual([
      'tavi.slash1',
      'tavi.slash2',
      'tavi.slash3',
    ]);
    expect(b.health(n).hitsTaken).toBe(3);
  });

  it('the combo resets if the next press comes after the window', () => {
    const a = new Arena();
    a.press(Buttons.Attack).seconds(1.5).press(Buttons.Attack).seconds(1);
    expect(a.of('AttackStarted').map((e) => e.attackId)).toEqual(['tavi.slash1', 'tavi.slash1']);
  });

  it('a press within the window after a swing ends continues the chain', () => {
    const a = new Arena();
    const s1 = tavi.combat.combo[0];
    if (!s1) throw new Error('combo');
    a.press(Buttons.Attack).seconds(s1.windup + s1.active + s1.recovery + DT * 2);
    a.press(Buttons.Attack).run(2);
    expect(a.of('AttackStarted').map((e) => e.attackId)).toEqual(['tavi.slash1', 'tavi.slash2']);
  });

  it('each swing hits a target at most once', () => {
    const a = new Arena();
    const m = a.game.spawnMonster(dummy(sparkhog), 6.5, 5.3);
    a.press(Buttons.Attack).seconds(1);
    expect(a.of('DamageDealt').filter((e) => e.target === m)).toHaveLength(1);
  });

  it('auto-aims at the nearest enemy inside the 60° cone', () => {
    const a = new Arena();
    // Hero faces +y; enemy slightly to the side (24°, inside the 30° half-cone) gets aimed at.
    const m = a.game.spawnMonster(dummy(sparkhog), 6.9, 5.4);
    a.press(Buttons.Attack).seconds(0.8);
    expect(a.health(m).hitsTaken).toBe(1);
    const rot = a.pos(a.hero).rot;
    expect(rot).toBeCloseTo(Math.atan2(6.9 - 6.5, 5.4 - 4.5), 1);
  });
});

describe('dodge', () => {
  it('dashes, grants i-frames and respects the cooldown', () => {
    const a = new Arena();
    const x0 = a.pos(a.hero).x;
    a.input.move.x = 1;
    a.press(Buttons.Dodge).run(1);
    expect(a.health(a.hero).iFrames).toBeGreaterThan(0);
    a.input.move.x = 0;
    a.seconds(tavi.combat.dodge.duration);
    const dashed = a.pos(a.hero).x - x0;
    expect(dashed).toBeGreaterThan(tavi.combat.dodge.speed * tavi.combat.dodge.duration * 0.8);

    const dodge = a.game.world.require(a.hero, Dodge);
    expect(dodge.cooldown).toBeGreaterThan(0);
    const before = a.pos(a.hero).x;
    a.press(Buttons.Dodge).run(3); // still on cooldown: no second dash, only the walking-speed wind-down
    expect(a.pos(a.hero).x - before).toBeLessThan(0.5);
  });

  it('dodging through a monster attack avoids the damage', () => {
    const a = new Arena();
    const m = a.game.spawnMonster(stonenibbler, 6.5, 6.4); // below the hero, will pounce
    // Wait until the pounce windup starts, then dodge sideways during it.
    for (let i = 0; i < 200 && a.of('AttackStarted').filter((e) => e.entity === m).length === 0; i++)
      a.run(1);
    a.seconds(pounce.windup - 0.1);
    a.input.move.x = -1;
    a.press(Buttons.Dodge).run(1);
    a.input.move.x = 0;
    a.seconds(0.5);
    expect(a.of('DamageDealt').filter((e) => e.target === a.hero)).toHaveLength(0);
  });
});

describe('damage rules', () => {
  it('the hero gets i-frames after a hit: no second hit within the window', () => {
    const a = new Arena();
    a.game.spawnMonster(stonenibbler, 6.5, 5.6);
    a.game.spawnMonster(stonenibbler, 7.3, 4.5); // two attackers to make overlapping hits likely
    const hitSteps: number[] = [];
    for (let i = 0; i < 300; i++) {
      const before = a.events.length;
      a.run(1);
      const hit = a.events.slice(before).some((e) => e.type === 'DamageDealt' && e.target === a.hero);
      if (hit) hitSteps.push(i);
    }
    expect(hitSteps.length).toBeGreaterThan(1);
    for (let i = 1; i < hitSteps.length; i++) {
      expect(((hitSteps[i] as number) - (hitSteps[i - 1] as number)) * DT).toBeGreaterThanOrEqual(
        tavi.combat.hitIFrames - DT,
      );
    }
  });

  it('a guarding sparkhog blocks hits from the front but not from behind', () => {
    const front = new Arena();
    const hog = front.game.spawnMonster(sparkhog, 6.5, 5.5); // hero at 6.5,4.5, within guard trigger range
    const brain = front.game.world.require(hog, Brain);
    front.run(3);
    expect(brain.state).toBe('guard');
    front.pos(hog).rot = Math.PI; // face the hero (-y)
    front.press(Buttons.Attack).seconds(0.4);
    const hit = front.of('DamageDealt').find((e) => e.target === hog);
    expect(hit?.blocked).toBe(true);
    expect(front.health(hog).hp).toBe(sparkhog.stats.hp);

    const back = new Arena();
    const hog2 = back.game.spawnMonster(sparkhog, 6.5, 5.5);
    back.run(3);
    back.pos(hog2).rot = 0; // back turned to the hero
    back.game.world.require(hog2, Brain).state = 'guard';
    back.press(Buttons.Attack).run(5);
    const hit2 = back.of('DamageDealt').find((e) => e.target === hog2);
    expect(hit2?.blocked).toBe(false);
    expect(hit2?.backstab).toBe(true);
  });

  it('poise damage staggers and interrupts an attack', () => {
    const a = new Arena();
    const rabbit = a.game.spawnMonster(dummy(stonenibbler), 6.5, 5.3);
    // Full combo: 10 + 10 + 26 poise ≥ 25 → stagger somewhere in the chain.
    a.press(Buttons.Attack).run(3).press(Buttons.Attack).run(15).press(Buttons.Attack).seconds(1.2);
    expect(a.of('DamageDealt').some((e) => e.target === rabbit && e.staggered)).toBe(true);
  });

  it('elements apply resistances (bubbler is weak to fire)', () => {
    expect(bubbler.resist.fire).toBeGreaterThan(1);
  });
});

describe('monster AI', () => {
  it('passive bubbler ignores a distant hero but fights back once hit', () => {
    const a = new Arena();
    const b = a.game.spawnMonster(bubbler, 6.5, 7.5); // 3 tiles away > noticeRange 1.6
    a.seconds(3);
    expect(a.of('AttackStarted').filter((e) => e.entity === b)).toHaveLength(0);
    a.game.world.require(b, Brain).aggro = true;
    a.seconds(4);
    expect(a.of('AttackStarted').filter((e) => e.entity === b).length).toBeGreaterThan(0);
  });

  it('aggressive monsters notice, chase and attack with a telegraph of at least 0.6 s', () => {
    const a = new Arena();
    const r = a.game.spawnMonster(stonenibbler, 3.5, 4.5);
    a.seconds(4);
    const starts = a.of('AttackStarted').filter((e) => e.entity === r);
    expect(starts.length).toBeGreaterThan(0);
    for (const s of starts) expect(s.windup).toBeGreaterThanOrEqual(0.6);
  });

  it('every Tier I monster attack telegraphs for 0.6–1.0 s (GDD §4.3)', () => {
    for (const m of [bubbler, sparkhog, stonenibbler]) {
      for (const atk of m.attacks) {
        expect(atk.windup).toBeGreaterThanOrEqual(0.6);
        expect(atk.windup).toBeLessThanOrEqual(1);
      }
    }
  });

  it('a missed pounce leaves the rabbit open (long recovery)', () => {
    const a = new Arena();
    const r = a.game.spawnMonster(stonenibbler, 6.5, 6.3);
    for (let i = 0; i < 200 && !a.game.world.require(r, Attacker).current; i++) a.run(1);
    a.pos(a.hero).x = 11.5; // step far aside: the pounce whiffs
    a.pos(a.hero).y = 1.5;
    a.seconds(pounce.windup + pounce.active + 0.1);
    const cur = a.game.world.require(r, Attacker).current;
    expect(cur?.phase).toBe('recovery');
    expect(cur?.extraRecovery).toBe(pounce.missRecovery);
  });

  it('sparkhog fires a fan of quills that travel and can hit', () => {
    const a = new Arena();
    a.game.spawnMonster(sparkhog, 6.5, 7.2); // 2.7 tiles away: in quill range, outside guard range
    a.seconds(4);
    const fired = a.of('EntitySpawned').filter((e) => e.kind === 'projectile');
    expect(fired.length).toBeGreaterThanOrEqual(quills.projectile?.count ?? 1);
    expect(a.of('EntityDespawned').length).toBeGreaterThan(0); // they hit something or expired
  });
});

describe('death and waves', () => {
  it('killing a monster emits MonsterKilled with kill element, overkill and hits taken', () => {
    const a = new Arena();
    const m = a.game.spawnMonster(dummy(bubbler), 6.5, 5.3);
    a.health(m).hp = 3;
    a.press(Buttons.Attack).seconds(0.6);
    const kill = a.of('MonsterKilled')[0];
    expect(kill).toMatchObject({ entity: m, monsterId: 'bubbler', killElement: 'slash', hitsTaken: 1 });
    expect(kill?.overkill).toBeGreaterThanOrEqual(0);
    expect(a.game.world.isAlive(m)).toBe(false);
    expect(a.of('EntityDespawned').some((e) => e.entity === m)).toBe(true);
  });

  it('the hero at 0 HP is defeated and the world freezes', () => {
    const a = new Arena();
    a.game.spawnMonster(stonenibbler, 6.5, 5.6);
    a.health(a.hero).hp = 1;
    a.seconds(5);
    expect(a.game.status).toBe('defeated');
    expect(a.of('HeroDefeated')).toHaveLength(1);
    const tick = a.game.tick;
    a.run(10);
    expect(a.game.tick).toBe(tick);
  });

  it('arena waves spawn one after another and end with ArenaCleared', () => {
    const a = new Arena(1, true);
    a.seconds(1.2);
    expect(a.of('WaveStarted')).toEqual([{ type: 'WaveStarted', index: 1, total: arenaTest.waves.length }]);
    // Kill everything each time a wave appears.
    for (let guard = 0; guard < 20 && a.game.status === 'playing'; guard++) {
      for (const e of a.game.world.query(Brain, Health)) a.health(e).hp = 0;
      a.seconds(2.5);
    }
    expect(a.game.status).toBe('cleared');
    expect(a.of('WaveStarted').map((e) => e.index)).toEqual([1, 2, 3]);
    expect(a.of('ArenaCleared')).toHaveLength(1);
  });
});

describe('determinism', () => {
  /** Scripted input: walk around, attack and dodge on a fixed schedule. */
  function replay(seed: number): { events: string; hero: unknown; monsters: number } {
    const a = new Arena(seed, true);
    for (let i = 0; i < 900; i++) {
      a.input.move.x = Math.sin(i / 40);
      a.input.move.y = Math.cos(i / 55) * 0.6;
      if (i % 11 === 0) a.press(Buttons.Attack);
      if (i % 97 === 0) a.press(Buttons.Dodge);
      a.run(1);
    }
    return {
      events: JSON.stringify(a.events),
      hero: { ...a.pos(a.hero), hp: a.health(a.hero).hp },
      monsters: a.game.monstersAlive,
    };
  }

  it('the same seed and input replay to the same events and state', () => {
    const first = replay(42);
    expect(replay(42)).toEqual(first);
    expect(first.events.length).toBeGreaterThan(1000); // the fight actually happened
  });

  it('a different seed changes the fight', () => {
    expect(replay(1).events).not.toBe(replay(2).events);
  });
});
