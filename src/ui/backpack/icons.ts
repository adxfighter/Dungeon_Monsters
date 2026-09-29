/** Emoji per ingredient icon id (backpack screen). Every `IngredientDef.iconKey` must be here (tested). */
export const INGREDIENT_ICONS: Readonly<Record<string, string>> = {
  meat: '🍖',
  fish: '🐟',
  roe: '🫧',
  fat: '🧈',
  shell: '🐚',
  spines: '🌵',
  flame: '🌶️',
  vial: '🧪',
  tentacle: '🦑',
  mushroom: '🍄',
  root: '🥕',
  onion: '🧅',
  moss: '🌿',
};

export const ingredientIcon = (key: string | undefined): string => INGREDIENT_ICONS[key ?? ''] ?? '•';
