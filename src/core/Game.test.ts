import { describe, expect, it } from 'vitest';
import { tavi } from '@content/characters/tavi';
import { monsters } from '@content/index';
import { stonenibbler } from '@content/monsters/tier1';
import { arenaTest } from '@content/rooms/arena_test';
import { createInputState } from '@shared/input';
import { Attacker, Brain, Health, Stats } from './components';
import { Game } from './Game';
import type { GameEvent } from './state/events';

const DT = 1 / 30;
const easy = arenaTest.difficulties.easy;
const hard = arenaTest.difficulties.hard;

function lobby(): { game: Game; run(seconds: number): GameEvent[] } {
  const game = new Game({ room: arenaTest.room, player: tavi, monsters, awaitStart: true, seed: 1 });
  const input = createInputState();
  return {
    game,
    run(seconds) {
      const events: GameEvent[] = [];
      for (let i = 0; i < Math.round(seconds / DT); i++) {
        game.step(input, DT);
        events.push(...game.drainEvents());
      }
      return events;
    },
  };
}

describe('arena lobby and difficulty (Game.awaitStart / startArena)', () => {
  it("waits in 'ready' with no waves and no monsters until a level is picked", () => {
    const { game, run } = lobby();
    expect(game.status).toBe('ready');
    const events = run(5); // far longer than any first-wave delay
    expect(events.some((e) => e.type === 'WaveStarted')).toBe(false);
    expect(game.monstersAlive).toBe(0);
    expect(game.waveCount).toBe(0);
  });

  it('startArena begins the chosen waves after the first delay; a second call is ignored', () => {
    const { game, run } = lobby();
    game.startArena(hard.waves, hard.monsters);
    expect(game.status).toBe('playing');
    expect(game.waveCount).toBe(hard.waves.length);
    const firstDelay = hard.waves[0]?.delay ?? 0;
    expect(run(firstDelay * 0.5).some((e) => e.type === 'WaveStarted')).toBe(false);
    expect(run(firstDelay).some((e) => e.type === 'WaveStarted')).toBe(true);
    game.startArena(easy.waves, easy.monsters);
    expect(game.waveCount).toBe(hard.waves.length);
  });

  it('startArena is a no-op for a game that did not wait in the lobby', () => {
    const game = new Game({ room: arenaTest.room, player: tavi, monsters, waves: hard.waves, seed: 1 });
    game.startArena(easy.waves, easy.monsters);
    expect(game.waveCount).toBe(hard.waves.length);
  });

  it('modifiers scale monster HP (rounded), ATK and the pause between attacks', () => {
    const game = new Game({
      room: arenaTest.room,
      player: tavi,
      monsters,
      modifiers: { hp: 0.5, atk: 2, attackCooldown: 3 },
    });
    const e = game.spawnMonster(stonenibbler, 2.5, 2.5);
    expect(game.world.require(e, Health).maxHp).toBe(Math.round(stonenibbler.stats.hp * 0.5));
    expect(game.world.require(e, Stats).atk).toBe(stonenibbler.stats.atk * 2);
    expect(game.world.require(e, Brain).attackCooldown).toBeCloseTo(stonenibbler.ai.attackCooldown * 3);
  });

  it('overrides replace the base numbers exactly (easy = the original M2 stats)', () => {
    const { game } = lobby();
    game.startArena(easy.waves, easy.monsters, easy.overrides);
    const e = game.spawnMonster(stonenibbler, 2.5, 2.5);
    const o = easy.overrides?.['stonenibbler'];
    expect(o).toBeDefined();
    expect(game.world.require(e, Health).maxHp).toBe(o?.hp);
    expect(game.world.require(e, Stats).atk).toBe(o?.atk);
    expect(game.world.require(e, Brain).attackCooldown).toBeCloseTo(o?.attackCooldown ?? -1);
  });

  it('every later attack also waits the level-adjusted cooldown (Brain.cooldownBase)', () => {
    const game = new Game({
      room: arenaTest.room,
      player: tavi,
      monsters,
      modifiers: { hp: 1, atk: 1, attackCooldown: 2 },
      overrides: { stonenibbler: { attackCooldown: 0.5 } },
    });
    const e = game.spawnMonster(stonenibbler, 6.5, 6.3); // right next to the hero
    game.world.require(game.player, Health).hp = 1e6;
    const input = createInputState();
    const brain = game.world.require(e, Brain);
    const attacker = game.world.require(e, Attacker);
    // Run until the first attack finishes and the brain resets its cooldown.
    let sawAttack = false;
    for (let i = 0; i < 300; i++) {
      game.step(input, DT);
      if (attacker.current) sawAttack = true;
      if (sawAttack && !attacker.current && brain.state === 'chase') break;
    }
    expect(sawAttack).toBe(true);
    expect(brain.attackCooldown).toBeCloseTo(0.5 * 2, 1); // override × modifier
  });

  it('a 0 s base cooldown with an override stays finite (no division by the base)', () => {
    const game = new Game({
      room: arenaTest.room,
      player: tavi,
      monsters,
      overrides: { stonenibbler: { attackCooldown: 0.5 } },
    });
    const def = { ...stonenibbler, ai: { ...stonenibbler.ai, attackCooldown: 0 } };
    const e = game.spawnMonster(def, 2.5, 2.5);
    expect(game.world.require(e, Brain).cooldownBase).toBe(0.5);
  });
});
