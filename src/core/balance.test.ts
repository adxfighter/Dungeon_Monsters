import { beforeAll, describe, expect, it } from 'vitest';
import { tavi } from '@content/characters/tavi';
import { arenas, monsters } from '@content/index';
import type { Arena, DifficultyId } from '@content/schemas';
import { Buttons, createInputState } from '@shared/input';
import { Attacker, Brain, Health, Status, Transform } from './components';
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
function runBot(arena: Arena, level: DifficultyId, seed: number, dodge: boolean): BotResult {
  const d = arena.difficulties[level];
  const game = new Game({
    room: arena.room,
    player: tavi,
    monsters,
    waves: d.waves,
    modifiers: d.monsters,
    ...(d.overrides ? { overrides: d.overrides } : {}),
    seed,
  });
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
    // No visible monster: walk to the nearest ripple (a submerged ambusher), as a player would.
    let ripple: { x: number; y: number } | null = null;
    for (const e of world.query(Brain, Health, Transform, Attacker)) {
      if (world.require(e, Health).hp <= 0) continue;
      // A player can't see or hit a submerged ambusher either — only its ripple.
      if (world.require(e, Brain).hidden) {
        ripple ??= world.require(e, Transform);
        continue;
      }
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

    if (world.require(game.player, Status).heldBy >= 0) {
      // Grabbed: mash Attack to break free, like a player (~10 presses/s).
      if (step % 3 === 0) input.buttons = Buttons.Attack;
    } else if (threat) {
      // Dash perpendicular to the line from the attacker.
      const ax = hero.x - threat.x;
      const ay = hero.y - threat.y;
      const len = Math.hypot(ax, ay) || 1;
      input.move.x = -ay / len;
      input.move.y = ax / len;
      input.buttons = Buttons.Dodge;
    } else if (best === Infinity && ripple && step % 6 === 0) {
      input.target.seq++;
      input.target.x = ripple.x;
      input.target.y = ripple.y;
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
 * Difficulty guard rails for the test arena, one block per level (user: hard "too hard", easy = as before PR #8).
 * The run table is printed only when an assertion fails (as the expect message) — handy when tuning.
 */
const count = (runs: BotResult[], status: BotResult['status']): number =>
  runs.filter((r) => r.status === status).length;

for (const arena of Object.values(arenas)) {
  describe(`${arena.id} difficulty (balance sanity)`, () => {
    const runs: Record<DifficultyId, { tank: BotResult[]; dodger: BotResult[] }> = {
      easy: { tank: [], dodger: [] },
      medium: { tank: [], dodger: [] },
      hard: { tank: [], dodger: [] },
    };
    beforeAll(() => {
      for (const level of ['easy', 'medium', 'hard'] as const) {
        runs[level].tank = SEEDS.map((s) => runBot(arena, level, s, false));
        runs[level].dodger = SEEDS.map((s) => runBot(arena, level, s, true));
      }
    });
    const report = (level: DifficultyId): string =>
      describeRuns(`${arena.id} ${level} face-tank:`, runs[level].tank) +
      '\n' +
      describeRuns(`${arena.id} ${level} dodger:`, runs[level].dodger);

    it('easy: even a bot that never dodges clears the arena in most runs', () => {
      expect(count(runs.easy.tank, 'cleared'), report('easy')).toBeGreaterThanOrEqual(SEEDS.length - 1);
      expect(count(runs.easy.dodger, 'cleared'), report('easy')).toBe(SEEDS.length);
    });

    it('medium: dodging always wins, face-tanking loses at least a third of the time', () => {
      expect(count(runs.medium.dodger, 'cleared'), report('medium')).toBe(SEEDS.length);
      expect(count(runs.medium.tank, 'defeated'), report('medium')).toBeGreaterThanOrEqual(
        Math.ceil(SEEDS.length / 3),
      );
    });

    it('hard: a bot that never dodges loses in most runs (not in wave 1); dodging still wins most runs', () => {
      const tank = runs.hard.tank;
      expect(count(tank, 'defeated'), report('hard')).toBeGreaterThanOrEqual(SEEDS.length - 1);
      for (const r of tank) expect(r.wave, report('hard')).toBeGreaterThanOrEqual(2);
      expect(count(runs.hard.dodger, 'cleared'), report('hard')).toBeGreaterThanOrEqual(
        Math.ceil(SEEDS.length * 0.6),
      );
    });

    it('levels are ordered: harder levels leave the dodging bot with less HP on average', () => {
      const avgHp = (level: DifficultyId) =>
        runs[level].dodger.reduce((sum, r) => sum + Math.max(0, r.hp), 0) / SEEDS.length;
      expect(avgHp('easy'), report('easy')).toBeGreaterThan(avgHp('medium'));
      expect(avgHp('medium'), report('medium')).toBeGreaterThan(avgHp('hard'));
    });
  });
}
