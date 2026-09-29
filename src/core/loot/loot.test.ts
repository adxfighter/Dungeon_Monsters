import { describe, expect, it } from 'vitest';
import { tavi } from '@content/characters/tavi';
import { ingredients, monsters } from '@content/index';
import type { IngredientDef, MonsterDef } from '@content/schemas';
import { Buttons, createInputState } from '@shared/input';
import { Arsenal, Attacker, Backpack, Carrion, Health, Status, Transform } from '../components';
import { Game } from '../Game';
import type { GameEvent } from '../state/events';
import { lootableCarcass } from '../systems/loot';
import { pouncer } from '../testing/monsters';
import { addToBackpack, backpackWeight, canFitOne, removeFromBackpack, type BackpackData } from './backpack';
import { ingredientStars } from './quality';

const DT = 1 / 30;
const meat: IngredientDef = {
  id: 'meat',
  nameKey: 'x',
  tags: ['meat'],
  weight: 2,
  flavor: { savory: 3, sweet: 0, sour: 0, bitter: 0, spicy: 0 },
  kill: { slash: 1, fire: -1 },
  iconKey: 'meat',
};
const herb: IngredientDef = {
  ...meat,
  id: 'herb',
  tags: ['herb'],
  weight: 0.5,
  kill: undefined,
} as IngredientDef;
const catalog = { meat, herb };

describe('ingredient quality', () => {
  it('a clean blade kill beats a roasting torch kill (GDD §4.3)', () => {
    expect(ingredientStars(meat, 2, { element: 'slash', overkillRatio: 0 })).toBe(3);
    expect(ingredientStars(meat, 2, { element: 'fire', overkillRatio: 0 })).toBe(1);
    expect(ingredientStars(meat, 2, { element: 'blunt', overkillRatio: 0 })).toBe(2);
  });

  it('a heavy overkill mangles the carcass; a skipped cut is always one star; stars stay within 1–3', () => {
    expect(ingredientStars(meat, 2, { element: 'slash', overkillRatio: 0.9 })).toBe(2);
    expect(ingredientStars(meat, 3, { element: 'slash', overkillRatio: 0 }, true)).toBe(1);
    expect(ingredientStars(meat, 3, { element: 'slash', overkillRatio: 0 })).toBe(3);
    expect(ingredientStars(meat, 1, { element: 'fire', overkillRatio: 0.9 })).toBe(1);
  });
});

describe('backpack', () => {
  const bag = (): BackpackData => ({ stacks: [], maxWeight: 10, maxSlots: 2 });

  it('stacks by ingredient and stars', () => {
    const b = bag();
    expect(addToBackpack(b, catalog, 'meat', 2, 1)).toBe(1);
    expect(addToBackpack(b, catalog, 'meat', 2, 2)).toBe(2);
    expect(b.stacks).toEqual([{ ingredientId: 'meat', stars: 2, count: 3 }]);
    expect(backpackWeight(b, catalog)).toBe(6);
  });

  it('stops at the weight limit and at the slot limit', () => {
    const b = bag();
    expect(addToBackpack(b, catalog, 'meat', 3, 9)).toBe(5); // 5 × 2 = 10 = maxWeight
    expect(addToBackpack(b, catalog, 'herb', 1, 1)).toBe(0); // no weight left
    const c = bag();
    addToBackpack(c, catalog, 'herb', 1, 1);
    addToBackpack(c, catalog, 'herb', 2, 1);
    expect(addToBackpack(c, catalog, 'herb', 3, 1)).toBe(0); // both slots used
    expect(addToBackpack(c, catalog, 'herb', 1, 1)).toBe(1); // an existing stack still grows
  });

  it('canFitOne agrees with addToBackpack: slots full → only a matching stack fits; weight full → nothing', () => {
    const b = bag();
    addToBackpack(b, catalog, 'herb', 1, 1);
    addToBackpack(b, catalog, 'herb', 2, 1);
    expect(canFitOne(b, catalog, 'herb', 1)).toBe(true); // existing stack
    expect(canFitOne(b, catalog, 'herb', 3)).toBe(false); // would need a third slot
    expect(canFitOne(b, catalog, 'meat', 2)).toBe(false);
    const heavy = bag();
    addToBackpack(heavy, catalog, 'meat', 2, 5); // 10 / 10
    expect(canFitOne(heavy, catalog, 'meat', 2)).toBe(false);
  });

  it('throws pieces away; an empty stack frees its slot', () => {
    const b = bag();
    addToBackpack(b, catalog, 'herb', 1, 3);
    expect(removeFromBackpack(b, 'herb', 1, 2)).toBe(2);
    expect(removeFromBackpack(b, 'herb', 1, 5)).toBe(1);
    expect(b.stacks).toEqual([]);
    expect(removeFromBackpack(b, 'herb', 1, 1)).toBe(0);
  });
});

const room = {
  id: 'loot',
  rows: ['#########', '#.......#', '#.......#', '#...P...#', '#.......#', '#.......#', '#########'],
};

/** A monster with one meat drop; it is left at 1 HP of 30 so one hit kills it without a mangling overkill. */
const victim: MonsterDef = {
  ...pouncer,
  id: 'victim',
  stats: { ...pouncer.stats, hp: 30, def: 0 },
  ai: { ...pouncer.ai, temperament: 'passive', noticeRange: 0.01 },
  drops: [
    {
      partId: 'ham',
      ingredientId: 'toadhog_ham',
      count: 1,
      cutLine: [
        [0.2, 0.5],
        [0.8, 0.5],
      ],
    },
  ],
};

function arena() {
  const game = new Game({ room, player: tavi, monsters: { ...monsters, victim }, ingredients, seed: 2 });
  const input = createInputState();
  const events: GameEvent[] = [];
  const run = (steps: number, buttons = 0) => {
    for (let i = 0; i < steps; i++) {
      input.buttons = i === 0 ? buttons : 0;
      game.step(input, DT);
      events.push(...game.drainEvents());
    }
  };
  return { game, input, events, run, w: game.world };
}

/** Butchers the carcass in reach with a ★2 cut on every part (the mini-game result). */
function butcherNear(a: ReturnType<typeof arena>, stars: 1 | 2 | 3 = 2) {
  a.game.butcher(lootableCarcass(a.w, a.game.player), { ham: stars }, false);
  a.run(2);
}

/** Kills the victim in front of the hero with the current weapon and butchers the carcass. */
function killAndButcher(swap: boolean) {
  const a = arena();
  if (swap) a.run(1, Buttons.Swap);
  a.w.require(a.game.player, Transform).rot = 0; // facing +y
  const v = a.game.spawnMonster(victim, 4.5, 4.3);
  a.w.require(v, Health).hp = 1;
  a.run(15, Buttons.Attack);
  const carcass = lootableCarcass(a.w, a.game.player);
  expect(carcass).toBeGreaterThanOrEqual(0);
  butcherNear(a);
  return a;
}

describe('butchering a carcass', () => {
  it('Action next to a carcass puts its parts in the backpack and removes it', () => {
    const a = killAndButcher(false);
    const loot = a.events.find((e) => e.type === 'LootTaken');
    expect(loot?.type === 'LootTaken' && loot.items).toEqual([
      { ingredientId: 'toadhog_ham', stars: 3, count: 1, stored: 1 }, // cut ★2 + clean blade kill
    ]);
    expect(a.w.require(a.game.player, Backpack).stacks).toEqual([
      { ingredientId: 'toadhog_ham', stars: 3, count: 1 },
    ]);
    expect(a.w.query(Carrion).length).toBe(0);
  });

  it('the same kill with the torch gives scorched meat (DoD M3: fire vs blade)', () => {
    const a = killAndButcher(true);
    expect(a.w.require(a.game.player, Backpack).stacks).toEqual([
      { ingredientId: 'toadhog_ham', stars: 1, count: 1 },
    ]);
  });

  it('what does not fit stays on the carcass; after making room it can be butchered again', () => {
    const a = arena();
    const bag = a.w.require(a.game.player, Backpack);
    bag.maxWeight = 0;
    const v = a.game.spawnMonster(victim, 4.5, 4.3);
    a.w.require(v, Health).hp = 0;
    a.run(2);
    butcherNear(a);
    const loot = a.events.find((e) => e.type === 'LootTaken');
    expect(loot?.type === 'LootTaken' && loot.items[0]?.stored).toBe(0);
    expect(bag.stacks).toEqual([]);
    expect(a.w.query(Carrion).length).toBe(1); // the ham is still on it
    bag.maxWeight = 30;
    butcherNear(a);
    expect(bag.stacks.map((s) => s.ingredientId)).toEqual(['toadhog_ham']);
    expect(a.w.query(Carrion).length).toBe(0);
  });

  it('no butchering while grabbed', () => {
    const a = arena();
    const v = a.game.spawnMonster(victim, 4.5, 4.3);
    a.w.require(v, Health).hp = 0;
    a.run(2);
    const holder = a.game.spawnMonster(pouncer, 1.5, 1.5);
    const status = a.w.require(a.game.player, Status);
    status.heldBy = holder;
    status.heldT = 5;
    butcherNear(a);
    expect(a.events.some((e) => e.type === 'LootTaken')).toBe(false);
    expect(a.w.query(Carrion).length).toBe(1);
  });

  it('overkill is measured against the level-scaled max HP (difficulty modifiers)', () => {
    // hp ×0.1 → the victim has 3 max HP: a ~10-damage blade kill is a heavy overkill (−1 star).
    const game = new Game({
      room,
      player: tavi,
      monsters: { ...monsters, victim },
      ingredients,
      seed: 2,
      modifiers: { hp: 0.1, atk: 1, attackCooldown: 1 },
    });
    const input = createInputState();
    game.world.require(game.player, Transform).rot = 0;
    game.spawnMonster(victim, 4.5, 4.3);
    for (let i = 0; i < 20; i++) {
      input.buttons = i === 0 ? Buttons.Attack : 0;
      if (i === 18) game.butcher(lootableCarcass(game.world, game.player), { ham: 2 });
      game.step(input, DT);
    }
    const c = game.world.require(game.player, Backpack).stacks[0];
    expect(c).toEqual({ ingredientId: 'toadhog_ham', stars: 2, count: 1 }); // ★2 cut + blade +1 − overkill 1
  });

  it('Action does nothing out of reach', () => {
    const a = arena();
    a.game.spawnMonster(victim, 1.5, 1.5);
    a.w.require(a.game.player, Health).hp = 1e6;
    const e = a.game.spawnMonster(victim, 7.5, 5.5);
    a.w.require(e, Health).hp = 0;
    a.run(2);
    expect(a.w.query(Carrion).length).toBe(1);
    butcherNear(a);
    expect(a.events.some((ev) => ev.type === 'LootTaken')).toBe(false);
    expect(a.w.query(Carrion).length).toBe(1);
  });
});

describe('butchery results', () => {
  it('each part takes its own cut; a skipped butchery is ★1 for everything', () => {
    const two: MonsterDef = {
      ...victim,
      id: 'two',
      drops: [
        {
          partId: 'ham',
          ingredientId: 'toadhog_ham',
          count: 1,
          cutLine: [
            [0, 0],
            [1, 1],
          ],
        },
        {
          partId: 'legs',
          ingredientId: 'toadhog_legs',
          count: 1,
          cutLine: [
            [0, 1],
            [1, 0],
          ],
        },
      ],
    };
    const kill = (cuts: Record<string, 1 | 2 | 3>, skipped: boolean) => {
      const game = new Game({ room, player: tavi, monsters: { ...monsters, two }, ingredients, seed: 2 });
      const e = game.spawnMonster(two, 4.5, 4.3);
      game.world.require(e, Health).hp = 0;
      const input = createInputState();
      game.step(input, DT);
      game.butcher(lootableCarcass(game.world, game.player), cuts, skipped);
      game.step(input, DT);
      return game.world.require(game.player, Backpack).stacks.map((s) => `${s.ingredientId}:${s.stars}`);
    };
    // A debug kill is 'blunt' (no modifier for ham, none for legs): the cut is the star rating.
    expect(kill({ ham: 3, legs: 1 }, false)).toEqual(['toadhog_ham:3', 'toadhog_legs:1']);
    expect(kill({ ham: 3, legs: 3 }, true)).toEqual(['toadhog_ham:1', 'toadhog_legs:1']);
    expect(kill({}, false)).toEqual(['toadhog_ham:1', 'toadhog_legs:1']); // no result → ★1
  });

  it('a command for a carcass out of reach is ignored', () => {
    const game = new Game({ room, player: tavi, monsters: { ...monsters, victim }, ingredients, seed: 2 });
    const e = game.spawnMonster(victim, 7.5, 5.5);
    game.world.require(e, Health).hp = 0;
    const input = createInputState();
    game.step(input, DT);
    const c = game.world.query(Carrion)[0] ?? -1;
    game.butcher(c, { ham: 3 });
    game.step(input, DT);
    expect(game.world.query(Carrion).length).toBe(1);
    expect(game.world.require(game.player, Backpack).stacks).toEqual([]);
  });
});

describe('context button (interaction selector)', () => {
  const setup = () => {
    const game = new Game({ room, player: tavi, monsters: { ...monsters, victim }, ingredients, seed: 2 });
    return { game, input: createInputState() };
  };

  it('butcher only when a part fits and the hero is free to act', () => {
    const { game, input } = setup();
    const e = game.spawnMonster(victim, 4.5, 4.3);
    game.world.require(e, Health).hp = 0;
    game.step(input, DT);
    const c = game.world.query(Carrion)[0] ?? -1;
    expect(game.interaction).toEqual({ kind: 'butcher', entity: c });
    game.world.require(game.player, Health).stagger = 1;
    expect(game.interaction).toBeNull();
    game.world.require(game.player, Health).stagger = 0;
    const status = game.world.require(game.player, Status);
    status.heldBy = c; // any entity: "held"
    expect(game.interaction).toBeNull();
    status.heldBy = -1;
    game.world.require(game.player, Backpack).maxWeight = 0;
    expect(game.interaction).toEqual({ kind: 'full', entity: c }); // in reach, nothing would fit
  });

  it('picks the nearest carcass that would give something, not just the nearest one', () => {
    const heavy: MonsterDef = {
      ...victim,
      id: 'heavy',
      drops: [
        {
          partId: 'steak',
          ingredientId: 'yak_steak',
          count: 1,
          cutLine: [
            [0, 0],
            [1, 1],
          ],
        },
      ],
    };
    const light: MonsterDef = {
      ...victim,
      id: 'light',
      drops: [
        {
          partId: 'moss',
          ingredientId: 'honey_moss',
          count: 1,
          cutLine: [
            [0, 0],
            [1, 1],
          ],
        },
      ],
    };
    const game = new Game({
      room,
      player: tavi,
      monsters: { ...monsters, heavy, light },
      ingredients,
      seed: 2,
    });
    const input = createInputState();
    const near = game.spawnMonster(heavy, 4.5, 4.2); // 0.7 away
    const far = game.spawnMonster(light, 4.5, 2.6); // 0.9 away, still in reach
    game.world.require(near, Health).hp = 0;
    game.world.require(far, Health).hp = 0;
    game.step(input, DT);
    game.world.require(game.player, Backpack).maxWeight = 1; // steak weighs 3, moss 0.5
    const lightCarcass = game.world
      .query(Carrion)
      .find((c) => game.world.require(c, Carrion).monsterId === 'light');
    expect(game.interaction).toEqual({ kind: 'butcher', entity: lightCarcass });
  });
});

describe('plants and discarding', () => {
  const plantRoom = { ...room, plants: [{ ingredientId: 'glowcap', x: 4.5, y: 4.2, count: 2 }] };
  const make = () => {
    const game = new Game({ room: plantRoom, player: tavi, monsters, ingredients, seed: 2 });
    const input = createInputState();
    game.step(input, DT);
    return { game, input };
  };

  it('a plant in reach can be gathered: ★2 pieces into the backpack, the plant is gone', () => {
    const { game, input } = make();
    const i = game.interaction;
    expect(i?.kind).toBe('gather');
    if (i) game.gather(i.entity);
    game.step(input, DT);
    expect(game.backpack?.stacks).toEqual([{ ingredientId: 'glowcap', stars: 2, count: 2 }]);
    expect(game.interaction).toBeNull();
  });

  it('a plant out of reach is ignored; what does not fit stays on the plant', () => {
    const { game, input } = make();
    const plant = game.interaction?.entity ?? -1;
    game.world.require(game.player, Transform).x = 1.5;
    game.gather(plant);
    game.step(input, DT);
    expect(game.backpack?.stacks).toEqual([]);
    game.world.require(game.player, Transform).x = 4.5;
    const bag = game.world.require(game.player, Backpack);
    bag.maxWeight = 0.5; // one glowcap
    game.gather(plant);
    game.step(input, DT);
    expect(bag.stacks).toEqual([{ ingredientId: 'glowcap', stars: 2, count: 1 }]);
    expect(game.interaction?.kind).toBe('full');
  });

  it('applyCommands applies a discard without advancing the simulation (menus pause the fight)', () => {
    const { game } = make();
    const bag = game.world.require(game.player, Backpack);
    bag.stacks.push({ ingredientId: 'yak_steak', stars: 2, count: 2 });
    const e = game.spawnMonster(victim, 7.5, 5.5);
    game.world.require(e, Health).hp = 0;
    game.step(createInputState(), DT);
    game.drainEvents();
    const tick = game.tick;
    const ttl = game.world.require(game.world.query(Carrion)[0] ?? -1, Carrion).ttl;
    game.discard('yak_steak', 2, 1);
    game.applyCommands();
    expect(bag.stacks).toEqual([{ ingredientId: 'yak_steak', stars: 2, count: 1 }]);
    expect(game.tick).toBe(tick);
    expect(game.world.require(game.world.query(Carrion)[0] ?? -1, Carrion).ttl).toBe(ttl);
    expect(game.drainEvents()).toContainEqual({
      type: 'Discarded',
      by: game.player,
      ingredientId: 'yak_steak',
      stars: 2,
      count: 1,
    });
  });

  it('no gathering while staggered', () => {
    const { game, input } = make();
    const plant = game.interaction?.entity ?? -1;
    game.world.require(game.player, Health).stagger = 1;
    game.gather(plant);
    game.step(input, DT);
    expect(game.backpack?.stacks).toEqual([]);
  });

  it('discard throws pieces out of a stack', () => {
    const { game, input } = make();
    const bag = game.world.require(game.player, Backpack);
    bag.stacks.push({ ingredientId: 'yak_steak', stars: 3, count: 2 });
    game.discard('yak_steak', 3, 1);
    game.step(input, DT);
    expect(bag.stacks).toEqual([{ ingredientId: 'yak_steak', stars: 3, count: 1 }]);
  });
});

describe('arena end', () => {
  it('the win screen waits until the carcasses of the last wave are butchered', () => {
    const game = new Game({
      room,
      player: tavi,
      monsters: { ...monsters, victim },
      ingredients,
      seed: 2,
      waves: [{ delay: 0, spawns: [{ monster: 'victim', x: 4.5, y: 4.3 }] }],
    });
    const input = createInputState();
    const step = (buttons = 0) => {
      input.buttons = buttons;
      game.step(input, DT);
    };
    step();
    step();
    const monster = game.world.query(Health).find((e) => e !== game.player) ?? -1;
    game.world.require(monster, Health).hp = 0;
    for (let i = 0; i < 10; i++) step();
    expect(game.world.query(Carrion).length).toBe(1);
    expect(game.status).toBe('playing'); // the carcass is still there to butcher
    expect(game.awaitingCarcasses).toBe(true); // the UI shows the "butcher them" hint
    game.butcher(lootableCarcass(game.world, game.player), { ham: 2 });
    step();
    step();
    expect(game.status).toBe('cleared');
    expect(game.awaitingCarcasses).toBe(false);
  });
});

describe('arena end with a full backpack', () => {
  it('carcasses that give nothing (backpack full) do not hold back the win', () => {
    const game = new Game({
      room,
      player: tavi,
      monsters: { ...monsters, victim },
      ingredients,
      seed: 2,
      waves: [{ delay: 0, spawns: [{ monster: 'victim', x: 4.5, y: 4.3 }] }],
    });
    const input = createInputState();
    game.world.require(game.player, Backpack).maxWeight = 0;
    game.step(input, DT);
    game.step(input, DT);
    const monster = game.world.query(Health).find((e) => e !== game.player) ?? -1;
    game.world.require(monster, Health).hp = 0;
    for (let i = 0; i < 5; i++) game.step(input, DT);
    expect(game.world.query(Carrion).length).toBe(1);
    expect(game.awaitingCarcasses).toBe(false);
    expect(game.status).toBe('cleared');
  });
});

describe('weapon swap', () => {
  it('Swap switches the combo to the torch (fire) and back', () => {
    const a = arena();
    const attacker = a.w.require(a.game.player, Attacker);
    expect(attacker.attacks[0]?.element).toBe('slash');
    a.run(1, Buttons.Swap);
    expect(a.w.require(a.game.player, Arsenal).index).toBe(1);
    expect(attacker.attacks[0]?.element).toBe('fire');
    expect(a.events.some((e) => e.type === 'WeaponSwapped' && e.weaponId === 'torch')).toBe(true);
    a.run(1, Buttons.Swap);
    expect(attacker.attacks[0]?.element).toBe('slash');
  });

  it('a swap pressed mid-swing waits for the swing to end, then applies', () => {
    const a = arena();
    a.run(1, Buttons.Attack);
    expect(a.w.require(a.game.player, Attacker).current).not.toBeNull();
    a.run(1, Buttons.Swap);
    expect(a.w.require(a.game.player, Arsenal).index).toBe(0); // not in the middle of the swing
    a.run(20);
    expect(a.w.require(a.game.player, Attacker).current).toBeNull();
    expect(a.w.require(a.game.player, Arsenal).index).toBe(1);
    expect(a.w.require(a.game.player, Attacker).attacks[0]?.element).toBe('fire');
  });

  it('two swap presses during one swing cancel out (swap there and back)', () => {
    const a = arena();
    a.run(1, Buttons.Attack);
    a.run(1, Buttons.Swap);
    a.run(1, Buttons.Swap);
    a.run(20);
    expect(a.w.require(a.game.player, Arsenal).index).toBe(0);
  });
});
