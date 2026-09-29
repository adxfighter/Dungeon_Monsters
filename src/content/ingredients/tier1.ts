import type { IngredientDef } from '../schemas';

/**
 * Ingredients of the M3 roster (user decision 2026-09-29: 1–2 parts from each of the 10 monsters + 5 plants).
 * `kill` shifts the star rating by how the monster died (GDD §4.3): meat cut cleanly by a blade is better, meat
 * roasted by the torch is scorched; bones crumble under blunt blows; glands and jelly spoil in fire.
 * Original names — no Dungeon Meshi dishes or ingredients (docs/LEGAL.md).
 */
const MEAT_KILL = { slash: 1, fire: -1 } as const;

const list: IngredientDef[] = [
  // Brooklash (ambush eel)
  {
    id: 'brooklash_fillet',
    nameKey: 'ingredient.brooklash_fillet',
    tags: ['meat'],
    weight: 1.5,
    perishable: true,
    flavor: { savory: 3, sweet: 1, sour: 0, bitter: 0, spicy: 0 },
    kill: MEAT_KILL,
    iconKey: 'fish',
  },
  {
    id: 'brooklash_roe',
    nameKey: 'ingredient.brooklash_roe',
    tags: ['egg'],
    weight: 0.5,
    perishable: true,
    flavor: { savory: 2, sweet: 0, sour: 1, bitter: 0, spicy: 0 },
    kill: { fire: -1 },
    iconKey: 'roe',
  },
  // Bonegnaw (scavenger beetle)
  {
    id: 'bonegnaw_fat',
    nameKey: 'ingredient.bonegnaw_fat',
    tags: ['fat'],
    weight: 1,
    flavor: { savory: 2, sweet: 2, sour: 0, bitter: 0, spicy: 0 },
    kill: { fire: -1 },
    iconKey: 'fat',
  },
  {
    id: 'bonegnaw_shell',
    nameKey: 'ingredient.bonegnaw_shell',
    tags: ['bone', 'spice'],
    weight: 0.5,
    flavor: { savory: 1, sweet: 0, sour: 0, bitter: 2, spicy: 0 },
    kill: { blunt: -1 },
    iconKey: 'shell',
  },
  // Fugu
  {
    id: 'fugu_fillet',
    nameKey: 'ingredient.fugu_fillet',
    tags: ['meat'],
    weight: 1,
    perishable: true,
    flavor: { savory: 3, sweet: 2, sour: 0, bitter: 0, spicy: 0 },
    kill: MEAT_KILL,
    iconKey: 'fish',
  },
  {
    id: 'fugu_spines',
    nameKey: 'ingredient.fugu_spines',
    tags: ['spice'],
    weight: 0.3,
    flavor: { savory: 0, sweet: 0, sour: 1, bitter: 2, spicy: 2 },
    kill: { fire: -1 },
    iconKey: 'spines',
  },
  // Polar porcupine
  {
    id: 'porcupine_meat',
    nameKey: 'ingredient.porcupine_meat',
    tags: ['meat'],
    weight: 2,
    flavor: { savory: 3, sweet: 0, sour: 0, bitter: 1, spicy: 0 },
    kill: MEAT_KILL,
    iconKey: 'meat',
  },
  {
    id: 'porcupine_quills',
    nameKey: 'ingredient.porcupine_quills',
    tags: ['spice'],
    weight: 0.3,
    flavor: { savory: 0, sweet: 1, sour: 0, bitter: 1, spicy: 1 },
    kill: { fire: -1, blunt: -1 },
    iconKey: 'spines',
  },
  // Toadhog
  {
    id: 'toadhog_ham',
    nameKey: 'ingredient.toadhog_ham',
    tags: ['meat'],
    weight: 2.5,
    flavor: { savory: 4, sweet: 1, sour: 0, bitter: 0, spicy: 0 },
    kill: MEAT_KILL,
    iconKey: 'meat',
  },
  {
    id: 'toadhog_legs',
    nameKey: 'ingredient.toadhog_legs',
    tags: ['meat'],
    weight: 1,
    flavor: { savory: 3, sweet: 1, sour: 0, bitter: 0, spicy: 0 },
    kill: { slash: 1 },
    iconKey: 'meat',
  },
  // Dragochick (fire-immune: it can't be roasted, and its crop keeps its heat)
  {
    id: 'dragochick_drumstick',
    nameKey: 'ingredient.dragochick_drumstick',
    tags: ['meat'],
    weight: 1.5,
    flavor: { savory: 3, sweet: 1, sour: 0, bitter: 0, spicy: 1 },
    kill: { slash: 1, cold: -1 },
    iconKey: 'meat',
  },
  {
    id: 'dragochick_crop',
    nameKey: 'ingredient.dragochick_crop',
    tags: ['spice'],
    weight: 0.5,
    flavor: { savory: 1, sweet: 0, sour: 0, bitter: 0, spicy: 5 },
    kill: { cold: -1 },
    iconKey: 'flame',
  },
  // Stink skunk
  {
    id: 'skunk_meat',
    nameKey: 'ingredient.skunk_meat',
    tags: ['meat'],
    weight: 1.5,
    flavor: { savory: 2, sweet: 0, sour: 2, bitter: 1, spicy: 0 },
    kill: MEAT_KILL,
    iconKey: 'meat',
  },
  {
    id: 'skunk_musk',
    nameKey: 'ingredient.skunk_musk',
    tags: ['liquid', 'spice'],
    weight: 0.5,
    flavor: { savory: 0, sweet: 0, sour: 1, bitter: 4, spicy: 1 },
    kill: { fire: -1 },
    iconKey: 'vial',
  },
  // Maniac yak
  {
    id: 'yak_steak',
    nameKey: 'ingredient.yak_steak',
    tags: ['meat'],
    weight: 3,
    flavor: { savory: 5, sweet: 0, sour: 0, bitter: 0, spicy: 0 },
    kill: MEAT_KILL,
    iconKey: 'meat',
  },
  {
    id: 'yak_fat',
    nameKey: 'ingredient.yak_fat',
    tags: ['fat'],
    weight: 1.5,
    flavor: { savory: 3, sweet: 1, sour: 0, bitter: 0, spicy: 0 },
    kill: { fire: -1 },
    iconKey: 'fat',
  },
  // Dino-ostrich
  {
    id: 'dinostrich_drumstick',
    nameKey: 'ingredient.dinostrich_drumstick',
    tags: ['meat'],
    weight: 2,
    flavor: { savory: 4, sweet: 1, sour: 0, bitter: 0, spicy: 0 },
    kill: MEAT_KILL,
    iconKey: 'meat',
  },
  {
    id: 'dinostrich_neck',
    nameKey: 'ingredient.dinostrich_neck',
    tags: ['meat'],
    weight: 1,
    flavor: { savory: 3, sweet: 0, sour: 0, bitter: 1, spicy: 0 },
    kill: MEAT_KILL,
    iconKey: 'meat',
  },
  // Decapus
  {
    id: 'decapus_tentacle',
    nameKey: 'ingredient.decapus_tentacle',
    tags: ['meat'],
    weight: 1,
    flavor: { savory: 3, sweet: 1, sour: 0, bitter: 0, spicy: 0 },
    kill: { slash: 1, blunt: -1 },
    iconKey: 'tentacle',
  },
  {
    id: 'decapus_ink',
    nameKey: 'ingredient.decapus_ink',
    tags: ['liquid'],
    weight: 0.5,
    flavor: { savory: 2, sweet: 0, sour: 0, bitter: 2, spicy: 0 },
    kill: { fire: -1 },
    iconKey: 'vial',
  },
  // Plants and fungi — gathered in rooms (M3, backpack task); no kill modifiers.
  {
    id: 'glowcap',
    nameKey: 'ingredient.glowcap',
    tags: ['fungus'],
    weight: 0.5,
    flavor: { savory: 3, sweet: 0, sour: 0, bitter: 1, spicy: 0 },
    iconKey: 'mushroom',
  },
  {
    id: 'pepper_puffball',
    nameKey: 'ingredient.pepper_puffball',
    tags: ['fungus', 'spice'],
    weight: 0.3,
    flavor: { savory: 1, sweet: 0, sour: 0, bitter: 0, spicy: 4 },
    iconKey: 'mushroom',
  },
  {
    id: 'sour_root',
    nameKey: 'ingredient.sour_root',
    tags: ['veg'],
    weight: 1,
    flavor: { savory: 1, sweet: 0, sour: 4, bitter: 0, spicy: 0 },
    iconKey: 'root',
  },
  {
    id: 'cave_onion',
    nameKey: 'ingredient.cave_onion',
    tags: ['veg', 'herb'],
    weight: 0.5,
    flavor: { savory: 2, sweet: 1, sour: 0, bitter: 0, spicy: 2 },
    iconKey: 'onion',
  },
  {
    id: 'honey_moss',
    nameKey: 'ingredient.honey_moss',
    tags: ['veg'],
    weight: 0.5,
    flavor: { savory: 0, sweet: 4, sour: 0, bitter: 1, spicy: 0 },
    iconKey: 'moss',
  },
];

export const tier1Ingredients: Readonly<Record<string, IngredientDef>> = Object.fromEntries(
  list.map((i) => [i.id, i]),
);
