import { describe, expect, it } from 'vitest';
import { tavi } from '@content/characters/tavi';
import { monsters } from '@content/index';
import { dragochick, fugu, toadhog } from '@content/monsters/newcomers';
import { bonegnaw, brooklash } from '@content/monsters/tier1';
import { Buttons, createInputState } from '@shared/input';
import { Attacker, Brain, Carrion, Health, Steering, Transform } from '../components';
import { Game } from '../Game';
import type { GameEvent } from '../state/events';
import { shellback } from '../testing/monsters';

const DT = 1 / 30;
const room = {
  id: 'newcomers',
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

function setup() {
  const game = new Game({ room, player: tavi, monsters, seed: 3 });
  const input = createInputState();
  const events: GameEvent[] = [];
  const run = (steps: number) => {
    for (let i = 0; i < steps; i++) {
      game.step(input, DT);
      input.buttons = 0;
      events.push(...game.drainEvents());
    }
  };
  return { game, input, events, run, w: game.world };
}

describe('new monsters (mechanics)', () => {
  it('toadhog moves in hops: steering pauses between hops', () => {
    const { game, run, w } = setup();
    const e = game.spawnMonster(toadhog, 2.5, 4.5); // 4 tiles away: chases
    const hop = toadhog.locomotion;
    if (!hop) throw new Error('toadhog must hop');
    let moving = 0;
    let still = 0;
    for (let i = 0; i < 30; i++) {
      run(1);
      const s = w.require(e, Steering);
      if (Math.hypot(s.x, s.y) > 0) moving++;
      else still++;
    }
    expect(moving).toBeGreaterThan(0);
    expect(still).toBeGreaterThan(0);
  });

  it('dragochick breathes fire and is immune to it', () => {
    expect(first(dragochick.attacks).element).toBe('fire');
    expect(dragochick.resist.fire).toBe(0);
  });

  it('a 360° shell (guard.arcDeg 360) blocks hits from every side, even the back', () => {
    const { game, input, run, events, w } = setup();
    const e = game.spawnMonster(shellback, 6.5, 5.3);
    const brain = w.require(e, Brain);
    brain.state = 'guard';
    w.require(e, Transform).rot = 0; // back turned to the hero (hero is at -y)
    input.buttons = Buttons.Attack;
    run(8);
    const hit = events.find((ev) => ev.type === 'DamageDealt' && ev.target === e);
    expect(hit && hit.type === 'DamageDealt' && hit.blocked).toBe(true);
    expect(w.require(e, Health).hp).toBe(shellback.stats.hp);
  });

  it('brooklash is untouchable while submerged, surfaces to bite, stays exposed, then dives', () => {
    const { game, input, run, events, w } = setup();
    const e = game.spawnMonster(brooklash, 6.5, 5.4); // right next to the hero, submerged
    const brain = w.require(e, Brain);
    expect(brain.hidden).toBe(true);
    brain.attackCooldown = 99; // don't surface yet
    input.buttons = Buttons.Attack;
    run(8);
    expect(events.some((ev) => ev.type === 'DamageDealt' && ev.target === e)).toBe(false);

    brain.attackCooldown = 0;
    for (let i = 0; i < 60 && !w.require(e, Attacker).current; i++) run(1);
    expect(brain.hidden).toBe(false); // surfaced for the bite
    for (let i = 0; i < 90 && brain.state !== 'exposed'; i++) run(1);
    expect(brain.state).toBe('exposed');
    run(Math.ceil((brooklash.ambush?.exposedTime ?? 0) / DT) + 2);
    expect(brain.hidden).toBe(true);
  });

  it('killed monsters leave a carcass that bonegnaw walks to and eats (healing)', () => {
    const { game, run, events, w } = setup();
    const b = game.spawnMonster(fugu, 2.5, 7.5);
    w.require(b, Health).hp = 0;
    run(1);
    const carcass = w.query(Carrion, Transform)[0];
    expect(carcass).toBeDefined();
    const beetle = game.spawnMonster(bonegnaw, 9.5, 7.5); // 7 tiles from the carcass, 3 from the hero's row
    w.require(beetle, Health).hp = 5;
    run(Math.ceil(8 / DT));
    expect(events.some((ev) => ev.type === 'CarrionEaten' && ev.by === beetle)).toBe(true);
    expect(w.require(beetle, Health).hp).toBe(w.require(beetle, Health).maxHp);
    expect(w.query(Carrion)).toHaveLength(0);
  });

  it('carcasses rot away on their own', () => {
    const { game, run, w } = setup();
    const b = game.spawnMonster(fugu, 2.5, 2.5);
    w.require(b, Health).hp = 0;
    run(1);
    expect(w.query(Carrion)).toHaveLength(1);
    run(Math.ceil(30 / DT));
    expect(w.query(Carrion)).toHaveLength(0);
  });
});

function first<T>(items: readonly T[]): T {
  const x = items[0];
  if (x === undefined) throw new Error('empty');
  return x;
}
