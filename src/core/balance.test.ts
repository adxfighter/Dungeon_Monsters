import { describe, expect, it } from 'vitest';
import { tavi } from '@content/characters/tavi';
import { monsters } from '@content/index';
import { arenaTest } from '@content/rooms/arena_test';
import { Buttons, createInputState } from '@shared/input';
import { Attacker, Brain, Health, Transform } from './components';
import { Game } from './Game';

const DT = 1 / 30;
const MAX_SECONDS = 240;
/** The dodging bot reacts this long before a telegraphed hit lands (a human needs ~0.2–0.3 s). */
const REACTION_S = 0.3;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

interface BotResult {
  status: Game['status'];
  hp: number;
  wave: number;
  seconds: number;
}

/**
 * Arena bot: tap-walks to the nearest monster and mashes attack. With `dodge`, it also dashes sideways when
 * a telegraphed attack aimed near it is about to land (it reads the windup like a player reads the decal).
 */
function runBot(seed: number, dodge: boolean): BotResult {
  const game = new Game({ room: arenaTest.room, player: tavi, monsters, waves: arenaTest.waves, seed });
  const input = createInputState();
  const { world } = game;
  let step = 0;
  for (; step < MAX_SECONDS / DT && game.status === 'playing'; step++) {
    const hero = world.require(game.player, Transform);
    input.buttons = 0;
    input.move.x = 0;
    input.move.y = 0;

    let best = Infinity;
    let tx = 0;
    let ty = 0;
    let threat: { x: number; y: number } | null = null;
    for (const e of world.query(Brain, Health, Transform, Attacker)) {
      if (world.require(e, Health).hp <= 0) continue;
      const t = world.require(e, Transform);
      const d = Math.hypot(t.x - hero.x, t.y - hero.y);
      if (d < best) {
        best = d;
        tx = t.x;
        ty = t.y;
      }
      const cur = world.require(e, Attacker).current;
      if (
        dodge &&
        cur?.phase === 'windup' &&
        cur.def.windup - cur.t <= REACTION_S &&
        d <= cur.def.range + 1.5
      ) {
        threat = t;
      }
    }

    if (threat) {
      // Dash perpendicular to the line from the attacker.
      const ax = hero.x - threat.x;
      const ay = hero.y - threat.y;
      const len = Math.hypot(ax, ay) || 1;
      input.move.x = -ay / len;
      input.move.y = ax / len;
      input.buttons = Buttons.Dodge;
    } else if (best < Infinity) {
      if (best > 0.9) {
        // Walk like a player: tap-to-move (A* around pillars), re-aimed a few times per second.
        if (step % 6 === 0) {
          input.target.seq++;
          input.target.x = tx;
          input.target.y = ty;
        }
      } else if (step % 8 === 0) {
        input.buttons = Buttons.Attack;
      }
    }
    game.step(input, DT);
    game.drainEvents();
  }
  return {
    status: game.status,
    hp: world.require(game.player, Health).hp,
    wave: game.waveNumber,
    seconds: step * DT,
  };
}

const describeRuns = (label: string, runs: BotResult[]): string =>
  `${label}\n` +
  runs
    .map(
      (r, i) =>
        `  seed ${SEEDS[i]}: ${r.status} hp=${Math.max(0, Math.round(r.hp))} wave=${r.wave} t=${r.seconds.toFixed(0)}s`,
    )
    .join('\n');

/**
 * Difficulty guard rails for the test arena (playtest 2026-09-29: "too easy, 55 HP left without dodging").
 * Standing and trading hits must lose; reading telegraphs and dodging must be able to win.
 */
describe('arena difficulty (balance sanity)', () => {
  const faceTank = SEEDS.map((s) => runBot(s, false));
  const dodger = SEEDS.map((s) => runBot(s, true));

  it('a bot that never dodges loses in most runs, but not in the first wave', () => {
    console.log(describeRuns('face-tank:', faceTank));
    const losses = faceTank.filter((r) => r.status === 'defeated').length;
    expect(losses).toBeGreaterThanOrEqual(SEEDS.length - 1);
    for (const r of faceTank) expect(r.wave).toBeGreaterThanOrEqual(2);
  });

  it('a bot that dodges telegraphed attacks clears the arena in most runs', () => {
    console.log(describeRuns('dodger:', dodger));
    const wins = dodger.filter((r) => r.status === 'cleared').length;
    expect(wins).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.6));
  });
});
