/** Rune Craft catalog: melee, magic, range, and food lines. */

export const START_GOLD = 40;

export const SHOP_MAX_LEVEL = 99;
export const DEFAULT_SKYBOX = 'blue';
/** Dungeon clear colour / fog, independent of the overworld Settings skybox. */
export const DUNGEON_SKYBOX = 'dark-grey';
export const SKYBOXES = [
  { id: 'white', label: 'White', color: 0xf4f4f0, fog: 0xeaeae4 },
  { id: 'black', label: 'Black', color: 0x0b0b0e, fog: 0x121218 },
  { id: 'dark-grey', label: 'Dark Grey', color: 0x3a3a40, fog: 0x3a3a40 },
  { id: 'blue', label: 'Blue', color: 0x5aa0d8, fog: 0x6aadd8 },
  { id: 'light-grey', label: 'Light Grey', color: 0xc5c5ca, fog: 0xc5c5ca },
  { id: 'peach', label: 'Peach', color: 0xf4c49a, fog: 0xf0c4a0 },
];

export function skyIdForScene(sceneMode, savedSky) {
  if (sceneMode === 'dungeon') return DUNGEON_SKYBOX;
  return SKYBOXES.some((item) => item.id === savedSky) ? savedSky : DEFAULT_SKYBOX;
}

export const KING_ROALD_MIN = 10 * 60;
export const KING_ROALD_MAX = 60 * 60;

export const HAIR_STYLES = [
  { id: 'short', label: 'Short' },
  { id: 'long', label: 'Long' },
  { id: 'bun', label: 'Bun' },
  { id: 'ponytail', label: 'Ponytail' },
];

export const FACE_HAIR = [
  { id: 'none', label: 'Clean shaven' },
  { id: 'beard', label: 'Beard' },
  { id: 'moustache', label: 'Moustache' },
  { id: 'goatee', label: 'Goatee' },
];

export const PLAYER_COLORS = {
  shirt: [
    { id: 'brown', label: 'Brown', color: 0x4a3020 },
    { id: 'red', label: 'Red', color: 0x8a2424 },
    { id: 'blue', label: 'Blue', color: 0x2a4a8a },
    { id: 'green', label: 'Green', color: 0x2d6a32 },
    { id: 'cream', label: 'Cream', color: 0xd8c8a8 },
    { id: 'black', label: 'Black', color: 0x1c1c1c },
  ],
  legs: [
    { id: 'brown', label: 'Brown', color: 0x2e2418 },
    { id: 'grey', label: 'Grey', color: 0x4a4a50 },
    { id: 'green', label: 'Green', color: 0x3a4a32 },
    { id: 'navy', label: 'Navy', color: 0x24304a },
  ],
  boots: [
    { id: 'black', label: 'Black', color: 0x24180e },
    { id: 'brown', label: 'Brown', color: 0x5a3a22 },
    { id: 'tan', label: 'Tan', color: 0x8a6a3b },
  ],
};

export function defaultAppearance() {
  return {
    hair: 'short',
    shirt: 'brown',
    legs: 'brown',
    boots: 'black',
    faceHair: 'none',
  };
}

export function appearanceColor(slot, id) {
  const list = PLAYER_COLORS[slot] ?? [];
  return list.find((item) => item.id === id)?.color ?? list[0]?.color ?? 0x4a3020;
}

export function normalizeAppearance(raw) {
  const fallback = defaultAppearance();
  if (!raw || typeof raw !== 'object') return fallback;
  const hair = HAIR_STYLES.some((item) => item.id === raw.hair) ? raw.hair : fallback.hair;
  const shirt = PLAYER_COLORS.shirt.some((item) => item.id === raw.shirt) ? raw.shirt : fallback.shirt;
  const legs = PLAYER_COLORS.legs.some((item) => item.id === raw.legs) ? raw.legs : fallback.legs;
  const boots = PLAYER_COLORS.boots.some((item) => item.id === raw.boots) ? raw.boots : fallback.boots;
  const faceHair = FACE_HAIR.some((item) => item.id === raw.faceHair) ? raw.faceHair : fallback.faceHair;
  return { hair, shirt, legs, boots, faceHair };
}

export const OTHER_CHANCE = 0.18;
export const ASPIRE_CHANCE = 0.25;
export const MAX_CUSTOMERS = 3;
export const FIRST_CUSTOMER_DELAY = 4;
export const SPAWN_GAP_MIN = 6;
export const SPAWN_GAP_MAX = 11;
export const PATIENT_WAIT = 9;
export const PATIENT_RECHECKS = 3;
export const REQUEST_WAIT = 58;

/** First higher tier unlocks at 20 crafts of the previous item, then 30, 40, … */
export const UNLOCK_START = 20;
export const UNLOCK_STEP = 10;
/** Mastery at 2× the crafts needed to unlock the next tier in that line. */
export const MASTERY_MULT = 2;
/** Mastered recipes finish in half the usual time. */
export const MASTERY_SPEED = 0.5;

export const ANVIL_TABS = [
  { id: 'melee', label: 'Melee' },
  { id: 'magic', label: 'Magic' },
  { id: 'ranged', label: 'Ranged' },
];

export const ANVIL_SUBTABS = [
  { id: 'weapon', label: 'Weapons' },
  { id: 'armour', label: 'Armour' },
  { id: 'ammo', label: 'Ammo' },
  { id: 'rune', label: 'Runes' },
];

/** One anvil ammo recipe action puts this many units in the chest. */
export const AMMO_BATCH = 20;

/** @deprecated Food moved to the cooking range; anvil uses ANVIL_TABS. */
export const CRAFT_TABS = ANVIL_TABS;

export const SHELF_SLOT_COUNT = 4;
export const SHELF_SLOT_IDS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
export const SHELF_SLOT_LABELS = ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right'];

export const METALS = [
  { id: 'bronze', name: 'Bronze', tint: 0x8a5a32, restock: 3, start: 12 },
  { id: 'iron', name: 'Iron', tint: 0x8a8f96, restock: 5, start: 2 },
  { id: 'steel', name: 'Steel', tint: 0xc5ccd4, restock: 7, start: 1 },
  { id: 'mithril', name: 'Mithril', tint: 0x3a6ec8, restock: 10, start: 1 },
  { id: 'adamant', name: 'Adamant', tint: 0x3a8a45, restock: 13, start: 0 },
  { id: 'runite', name: 'Runite', tint: 0x3ec8c4, restock: 16, start: 0 },
  { id: 'dragon', name: 'Dragon', tint: 0xb42a22, restock: 22, start: 0 },
];

export const DHIDE = [
  { id: 'blue', name: 'Blue', tint: 0x2a4a8a },
  { id: 'green', name: 'Green', tint: 0x2d6a32 },
  { id: 'red', name: 'Red', tint: 0x8a2424 },
  { id: 'black', name: 'Black', tint: 0x1c1c1c },
];

export const MAGIC_SETS = [
  { id: 'magic', name: 'Magic', tint: 0x3d4aaa, accent: 0xc4a05a },
  { id: 'mystic', name: 'Mystic', tint: 0x5a78d0, accent: 0xd8c878 },
  { id: 'battlemage', name: 'Battlemage', tint: 0x3a2a52, accent: 0xe3b34a },
  { id: 'lunar', name: 'Lunar', tint: 0xc8d2e4, accent: 0xf0f4fa },
  { id: 'ancient', name: 'Ancient', tint: 0xc4a05a, accent: 0x6a8f4e },
];

export const MAGIC_STAVES = [
  { id: 'staff', name: 'Staff', shape: 'staff_plain' },
  { id: 'mystic_staff', name: 'Mystic Staff', shape: 'staff_mystic' },
  { id: 'battle_staff', name: 'Battle Staff', shape: 'staff_battle' },
  { id: 'lunar_staff', name: 'Lunar Staff', shape: 'staff_lunar' },
  { id: 'ancient_staff', name: 'Ancient Staff', shape: 'staff_ancient' },
];

/** Seconds per +1 toward the 250 cap. Higher tier = slower. */
function regenEvery(tier) {
  return 8 * tier;
}

export const MATERIALS = {
  bronze: { id: 'bronze', name: 'Bronze Ore', restock: 0, start: 12, tier: 1, regenEvery: 0 },
  iron: { id: 'iron', name: 'Iron Ore', restock: 0, start: 2, tier: 2, regenEvery: 0 },
  steel: { id: 'steel', name: 'Steel Ore', restock: 0, start: 1, tier: 3, regenEvery: 0 },
  mithril: { id: 'mithril', name: 'Mithril Ore', restock: 0, start: 1, tier: 4, regenEvery: 0 },
  adamant: { id: 'adamant', name: 'Adamant Ore', restock: 0, start: 0, tier: 5, regenEvery: 0 },
  runite: { id: 'runite', name: 'Runite Ore', restock: 0, start: 0, tier: 6, regenEvery: 0 },
  dragon: { id: 'dragon', name: 'Dragon Ore', restock: 0, start: 0, tier: 7, regenEvery: 0 },
  logs: { id: 'logs', name: 'Logs', restock: 4, start: 8, tier: 1, regenEvery: regenEvery(1) },
  flax: { id: 'flax', name: 'Flax', restock: 4, start: 8, tier: 1, regenEvery: regenEvery(1) },
  bow_string: {
    id: 'bow_string',
    name: 'Bow String',
    restock: 0,
    start: 0,
    tier: 1,
    regenEvery: 0,
    crafted: true,
  },
  cloth: { id: 'cloth', name: 'Cloth', restock: 5, start: 8, tier: 1, regenEvery: regenEvery(1) },
  hide: { id: 'hide', name: 'Hide', restock: 5, start: 8, tier: 1, regenEvery: regenEvery(1) },
  egg: { id: 'egg', name: 'Egg', restock: 4, start: 4, tier: 1, regenEvery: regenEvery(1) },
  flour: { id: 'flour', name: 'Flour', restock: 3, start: 10, tier: 1, regenEvery: regenEvery(1) },
  pineapple: { id: 'pineapple', name: 'Pineapple', restock: 6, start: 3, tier: 1, regenEvery: regenEvery(1) },
  raspberry: { id: 'raspberry', name: 'Raspberry', restock: 6, start: 3, tier: 1, regenEvery: regenEvery(1) },
  chocolate: { id: 'chocolate', name: 'Chocolate', restock: 6, start: 2, tier: 1, regenEvery: regenEvery(1) },
  fish: { id: 'fish', name: 'Fish', restock: 6, start: 3, tier: 1, regenEvery: regenEvery(1) },
  herbs: { id: 'herbs', name: 'Herbs', restock: 5, start: 8, tier: 1, regenEvery: regenEvery(1) },
  water: { id: 'water', name: 'Water', restock: 2, start: 12, tier: 1, regenEvery: regenEvery(1) },
  essence: { id: 'essence', name: 'Essence', restock: 0, start: 10, tier: 1, regenEvery: 0 },
};

METALS.forEach((metal, index) => {
  MATERIALS[`${metal.id}_bar`] = {
    id: `${metal.id}_bar`,
    name: `${metal.name} Bar`,
    restock: 0,
    start: 0,
    tier: index + 1,
    regenEvery: 0,
    crafted: true,
    bar: true,
    metalId: metal.id,
    tint: metal.tint,
  };
});

export function isCraftedMaterial(materialId) {
  return Boolean(MATERIALS[materialId]?.crafted);
}

export function barIdForMetal(metalId) {
  return `${metalId}_bar`;
}

export const ARMOUR_SLOTS = ['helm', 'body', 'legs', 'boots', 'gloves'];

export const RECIPES = {};

export function unlockNeed(lineIndex) {
  if (lineIndex <= 0) return 0;
  return UNLOCK_START + UNLOCK_STEP * (lineIndex - 1);
}

/** Crafts of this piece needed for mastery (2× the next-tier unlock). */
export function masteryNeed(recipe) {
  return MASTERY_MULT * unlockNeed((recipe?.lineIndex ?? 0) + 1);
}

function addRecipe(recipe) {
  RECIPES[recipe.id] = recipe;
  return recipe;
}

function metalLine({
  piece,
  category,
  combatClass,
  buyers,
  extraMats = {},
  gold0 = 0,
  time0 = 3,
  price0 = 10,
  priceStep = 8,
  outputCount = 1,
}) {
  METALS.forEach((metal, index) => {
    const id = `${metal.id}_${piece.id}`;
    const previousId = index === 0 ? null : `${METALS[index - 1].id}_${piece.id}`;
    addRecipe({
      id,
      name: `${metal.name} ${piece.name}`,
      category,
      combatClass,
      slot: piece.slot,
      shape: piece.shape,
      setKey: metal.id,
      lineId: `${combatClass}-${piece.id}`,
      lineName: piece.name,
      lineIndex: index,
      previousId,
      unlockNeed: unlockNeed(index),
      tier: index + 1,
      cost: {
        materials: { [barIdForMetal(metal.id)]: piece.metalCost ?? 1, ...extraMats },
        gold: gold0 + index * 2,
      },
      time: time0 + index,
      price: price0 + index * priceStep,
      buyers,
      tint: metal.tint,
      outputCount,
    });
  });
}

const MELEE_WEAPONS = [
  { id: 'scimitar', name: 'Scimitar', slot: 'scimitar', shape: 'scimitar' },
  { id: 'dagger', name: 'Dagger', slot: 'dagger', shape: 'dagger' },
  { id: 'sword', name: 'Sword', slot: 'sword', shape: 'sword' },
  { id: 'mace', name: 'Mace', slot: 'mace', shape: 'mace' },
  { id: 'spear', name: 'Spear', slot: 'spear', shape: 'spear' },
  { id: '2h_sword', name: '2H Sword', slot: '2h', shape: '2h' },
  { id: 'defender', name: 'Defender', slot: 'offhand', shape: 'defender' },
];

const MELEE_ARMOUR = [
  { id: 'full_helm', name: 'Full Helm', slot: 'helm', shape: 'full_helm' },
  { id: 'med_helm', name: 'Med Helm', slot: 'helm', shape: 'med_helm' },
  { id: 'platebody', name: 'Platebody', slot: 'body', shape: 'platebody', metalCost: 2 },
  { id: 'platelegs', name: 'Platelegs', slot: 'legs', shape: 'platelegs' },
  { id: 'boots', name: 'Boots', slot: 'boots', shape: 'boots' },
  { id: 'gloves', name: 'Gloves', slot: 'gloves', shape: 'gloves' },
  { id: 'chainbody', name: 'Chainbody', slot: 'body', shape: 'chainbody' },
  { id: 'plateskirt', name: 'Plateskirt', slot: 'legs', shape: 'plateskirt' },
];

for (const piece of MELEE_WEAPONS) {
  metalLine({ piece, category: 'weapon', combatClass: 'melee', buyers: ['mercenary'] });
}
for (const piece of MELEE_ARMOUR) {
  metalLine({ piece, category: 'armour', combatClass: 'melee', buyers: ['mercenary'], time0: 4, price0: 12 });
}

const RANGE_WEAPONS = [
  { id: 'shortbow', name: 'Shortbow', slot: 'bow', shape: 'shortbow', extra: { logs: 1, bow_string: 1 } },
  { id: 'longbow', name: 'Longbow', slot: 'bow', shape: 'longbow', extra: { logs: 1, bow_string: 1 } },
  { id: 'crossbow', name: 'Crossbow', slot: 'bow', shape: 'crossbow', extra: { logs: 1, bow_string: 1 } },
  { id: 'knives', name: 'Knives', slot: 'thrown', shape: 'knives' },
  { id: 'thrownaxe', name: 'Thrown Axe', slot: 'thrown', shape: 'thrownaxe' },
];

for (const piece of RANGE_WEAPONS) {
  metalLine({
    piece,
    category: 'weapon',
    combatClass: 'range',
    buyers: ['ranger'],
    extraMats: piece.extra ?? {},
  });
}

// Ammo uses Runite naming to match Runite Bar / Runite gear. One craft is 20 units.
metalLine({
  piece: { id: 'arrows', name: 'Arrows', slot: 'ammo', shape: 'arrows' },
  category: 'ammo',
  combatClass: 'range',
  buyers: ['ranger'],
  extraMats: { logs: 1 },
  time0: 3,
  price0: 2,
  priceStep: 1,
  outputCount: AMMO_BATCH,
});

// Single-tier cannonballs: Steel Bar only (not a metal ladder). Same ×20 batch as arrows.
addRecipe({
  id: 'cannonballs',
  name: 'Cannonballs',
  category: 'ammo',
  combatClass: 'range',
  slot: 'ammo',
  shape: 'cannonballs',
  setKey: 'cannon',
  lineId: 'range-cannonballs',
  lineName: 'Cannonballs',
  lineIndex: 0,
  previousId: null,
  unlockNeed: 0,
  tier: 3,
  cost: { materials: { steel_bar: 1 }, gold: 0 },
  time: 5,
  price: 3,
  buyers: ['ranger', 'mercenary'],
  tint: 0xc5ccd4,
  outputCount: AMMO_BATCH,
});

const DHIDE_PIECES = [
  { id: 'coif', name: 'Coif', slot: 'helm', shape: 'dhide_coif' },
  { id: 'body', name: 'Body', slot: 'body', shape: 'dhide_body' },
  { id: 'chaps', name: 'Chaps', slot: 'legs', shape: 'dhide_chaps' },
  { id: 'vambraces', name: 'Vambraces', slot: 'gloves', shape: 'dhide_vambraces' },
  { id: 'boots', name: 'Boots', slot: 'boots', shape: 'dhide_boots' },
];

DHIDE.forEach((color, index) => {
  for (const piece of DHIDE_PIECES) {
    const id = `${color.id}_dhide_${piece.id}`;
    const previousId = index === 0 ? null : `${DHIDE[index - 1].id}_dhide_${piece.id}`;
    addRecipe({
      id,
      name: `${color.name} D'hide ${piece.name}`,
      category: 'armour',
      combatClass: 'range',
      slot: piece.slot,
      shape: piece.shape,
      setKey: `${color.id}-dhide`,
      lineId: `range-dhide-${piece.id}`,
      lineName: `D'hide ${piece.name}`,
      lineIndex: index,
      previousId,
      unlockNeed: unlockNeed(index),
      tier: index + 1,
      cost: { materials: { hide: 1 }, gold: index * 2 },
      time: 4 + index,
      price: 14 + index * 8,
      buyers: ['ranger'],
      tint: color.tint,
    });
  }
});

MAGIC_STAVES.forEach((staff, index) => {
  const previousId = index === 0 ? null : MAGIC_STAVES[index - 1].id;
  addRecipe({
    id: staff.id,
    name: staff.name,
    category: 'weapon',
    combatClass: 'magic',
    slot: 'staff',
    shape: staff.shape,
    setKey: staff.id,
    lineId: 'magic-staff',
    lineName: 'Staff',
    lineIndex: index,
    previousId,
    unlockNeed: unlockNeed(index),
    tier: index + 1,
    cost: {
      materials: { logs: 1, ...(index > 0 ? { cloth: 1 } : {}) },
      gold: index * 3,
    },
    time: 4 + index * 2,
    price: 16 + index * 10,
    buyers: ['hedgemage'],
    tint: MAGIC_SETS[index].tint,
  });
});

const MAGIC_ARMOUR = [
  { id: 'hat', name: 'Hat', slot: 'helm', shape: 'wizard_hat' },
  { id: 'robe_top', name: 'Robe Top', slot: 'body', shape: 'robe_top' },
  { id: 'robe_bottom', name: 'Robe Bottom', slot: 'legs', shape: 'robe_bottom' },
  { id: 'boots', name: 'Boots', slot: 'boots', shape: 'magic_boots' },
  { id: 'gloves', name: 'Gloves', slot: 'gloves', shape: 'magic_gloves' },
];

MAGIC_SETS.forEach((set, index) => {
  for (const piece of MAGIC_ARMOUR) {
    const id = `${set.id}_${piece.id}`;
    const previousId = index === 0 ? null : `${MAGIC_SETS[index - 1].id}_${piece.id}`;
    addRecipe({
      id,
      name: `${set.name} ${piece.name}`,
      category: 'armour',
      combatClass: 'magic',
      slot: piece.slot,
      shape: piece.shape,
      setKey: set.id,
      lineId: `magic-${piece.id}`,
      lineName: piece.name,
      lineIndex: index,
      previousId,
      unlockNeed: unlockNeed(index),
      tier: index + 1,
      cost: { materials: { cloth: piece.id === 'robe_top' ? 2 : 1 }, gold: index * 2 },
      time: 4 + index,
      price: 14 + index * 9,
      buyers: ['hedgemage'],
      tint: set.tint,
      accent: set.accent,
    });
  }
});

/** Air → Earth → Water → Fire. Same 20 / 30 / +10 unlock ladder as weapon lines. */
const RUNE_LINE = [
  { id: 'air_rune', name: 'Air Rune', mark: 'air', tint: 0xf4f4f0 },
  { id: 'earth_rune', name: 'Earth Rune', mark: 'earth', tint: 0x8a5a32 },
  { id: 'water_rune', name: 'Water Rune', mark: 'water', tint: 0x3a7ec8 },
  { id: 'fire_rune', name: 'Fire Rune', mark: 'fire', tint: 0xc42a22 },
];

RUNE_LINE.forEach((rune, index) => {
  const previousId = index === 0 ? null : RUNE_LINE[index - 1].id;
  addRecipe({
    id: rune.id,
    name: rune.name,
    category: 'rune',
    combatClass: 'magic',
    slot: 'rune',
    shape: 'rune',
    runeMark: rune.mark,
    setKey: 'runes',
    lineId: 'magic-runes',
    lineName: 'Runes',
    lineIndex: index,
    previousId,
    unlockNeed: unlockNeed(index),
    tier: index + 1,
    cost: { materials: { essence: 1 }, gold: 0 },
    time: 3 + index,
    price: [20, 28, 36, 48][index],
    buyers: ['hedgemage', 'pilgrim', 'mercenary', 'ranger'],
    tint: rune.tint,
    shelfItem: true,
  });
});

const FOOD_LINE = [
  { id: 'bread', name: 'Bread', mats: { flour: 1 }, tint: 0xc4a05a, time: 3, price: 8 },
  { id: 'pizza', name: 'Pizza', mats: { flour: 1, pineapple: 1 }, tint: 0xd4a04a, time: 4, price: 14 },
  { id: 'cake', name: 'Cake', mats: { flour: 1, egg: 1 }, tint: 0xe8c8a0, time: 5, price: 20 },
  { id: 'pie', name: 'Pie', mats: { flour: 1, raspberry: 1 }, tint: 0xb45a4a, time: 6, price: 26 },
  { id: 'fish_pie', name: 'Fish Pie', mats: { flour: 1, fish: 1 }, tint: 0xc8b07a, time: 7, price: 32 },
];

/** Grill / feast line. Prices sit around Cake (20g): Salmon below, then Lobster and up. */
const FEAST_LINE = [
  { id: 'salmon', name: 'Salmon', mats: { fish: 1 }, tint: 0xe07a4a, time: 3, price: 16 },
  { id: 'lobster', name: 'Lobster', mats: { fish: 1 }, tint: 0xc45a32, time: 5, price: 28 },
  { id: 'chocolate_cake', name: 'Chocolate Cake', mats: { flour: 1, egg: 1, chocolate: 1 }, tint: 0x5a3220, time: 6, price: 38 },
  { id: 'monkfish', name: 'Monkfish', mats: { fish: 2 }, tint: 0xd8c8a0, time: 7, price: 50 },
  { id: 'curry', name: 'Curry', mats: { fish: 1, herbs: 1 }, tint: 0xd48a28, time: 8, price: 64 },
  { id: 'shark', name: 'Shark', mats: { fish: 2 }, tint: 0x6a7a88, time: 9, price: 80 },
  { id: 'summer_pie', name: 'Summer Pie', mats: { flour: 1, pineapple: 1, raspberry: 1 }, tint: 0xe8a04a, time: 10, price: 98 },
  { id: 'anglerfish', name: 'Anglerfish', mats: { fish: 3 }, tint: 0xc8a04a, time: 12, price: 120 },
];

function addFoodLine(list, lineId, lineName, setKey, firstPreviousId = null) {
  list.forEach((food, index) => {
    const previousId = index === 0 ? firstPreviousId : list[index - 1].id;
    const need = index === 0 && firstPreviousId ? unlockNeed(1) : unlockNeed(index);
    addRecipe({
      id: food.id,
      name: food.name,
      category: 'food',
      combatClass: null,
      slot: 'food',
      shape: food.id,
      setKey,
      lineId,
      lineName,
      lineIndex: index,
      previousId,
      unlockNeed: need,
      tier: index + 1,
      cost: { materials: { ...food.mats }, gold: 0 },
      time: food.time,
      price: food.price,
      buyers: ['pilgrim'],
      tint: food.tint,
      shelfItem: true,
    });
  });
}

// Food is small and sits on wall shelves. Potions share the same four shelf slots.
addFoodLine(FOOD_LINE, 'food-bake', 'Kitchen', 'kitchen');
addFoodLine(FEAST_LINE, 'food-feast', 'Feast', 'feast', 'bread');

const POTION_LINE = [
  { id: 'strength_potion', name: 'Strength Potion', tint: 0xe8d24a, buyers: ['mercenary'], price: 1000 },
  { id: 'prayer_potion', name: 'Prayer Potion', tint: 0x3ec8c4, buyers: ['pilgrim', 'hedgemage'], price: 1500 },
  { id: 'attack_potion', name: 'Attack Potion', tint: 0x40c8c0, buyers: ['mercenary'], price: 2250 },
  { id: 'anti_poison_potion', name: 'Anti Poison Potion', tint: 0x8ee53f, buyers: ['mercenary', 'ranger'], price: 3500 },
  { id: 'ranging_potion', name: 'Ranging Potion', tint: 0x87ceeb, buyers: ['ranger'], price: 5000 },
  { id: 'antifire_potion', name: 'Antifire Potion', tint: 0x8a4ec8, buyers: ['mercenary', 'ranger'], price: 7500 },
  { id: 'energy_potion', name: 'Energy Potion', tint: 0xe87aa8, buyers: ['pilgrim', 'ranger'], price: 11000 },
  { id: 'magic_potion', name: 'Magic Potion', tint: 0xf4c49a, buyers: ['hedgemage'], price: 16000 },
];

POTION_LINE.forEach((potion, index) => {
  const previousId = index === 0 ? null : POTION_LINE[index - 1].id;
  addRecipe({
    id: potion.id,
    name: potion.name,
    category: 'potion',
    combatClass: null,
    slot: 'potion',
    shape: 'potion',
    setKey: 'brew',
    lineId: 'potion-brew',
    lineName: 'Vials',
    lineIndex: index,
    previousId,
    unlockNeed: index === 0 ? 0 : 5,
    tier: index + 1,
    cost: {
      materials: { herbs: index >= 4 ? 2 : 1, water: 1 },
      gold: 0,
    },
    time: 4 + index,
    price: potion.price,
    buyers: potion.buyers,
    tint: potion.tint,
    shelfItem: true,
  });
});

METALS.forEach((metal, index) => {
  const previousId = index === 0 ? null : `smelt_${METALS[index - 1].id}`;
  addRecipe({
    id: `smelt_${metal.id}`,
    name: `${metal.name} Bar`,
    category: 'smelt',
    combatClass: null,
    slot: 'bar',
    shape: 'bar',
    setKey: 'smelt',
    lineId: 'smelt-bars',
    lineName: 'Metal Bars',
    lineIndex: index,
    previousId,
    unlockNeed: unlockNeed(index),
    tier: index + 1,
    cost: { materials: { [metal.id]: 1 }, gold: 0 },
    time: 3 + index,
    price: 0,
    buyers: [],
    tint: metal.tint,
    outputMaterial: `${metal.id}_bar`,
    outputCount: 1,
  });
});

addRecipe({
  id: 'spin_bow_string',
  name: 'Bow String',
  category: 'spin',
  combatClass: null,
  slot: 'fibre',
  shape: 'bow_string',
  setKey: 'spin',
  lineId: 'spin-fibre',
  lineName: 'Fibre',
  lineIndex: 0,
  previousId: null,
  unlockNeed: 0,
  tier: 1,
  cost: { materials: { flax: 1 }, gold: 0 },
  time: 4,
  price: 0,
  buyers: [],
  tint: 0xd8c8a0,
  outputMaterial: 'bow_string',
  outputCount: 1,
});

export const CUSTOMERS = {
  pilgrim: {
    id: 'pilgrim',
    name: 'Pilgrim',
    combatClass: null,
    prefers: [
      ...FOOD_LINE.map((food) => food.id),
      ...FEAST_LINE.map((food) => food.id),
      'prayer_potion',
      'energy_potion',
      ...RUNE_LINE.map((rune) => rune.id),
    ],
    patient: true,
    leaveIfEmpty: false,
    robe: 0xc8b48a,
    accent: 0x6b4e31,
    offer: { materialId: 'flour', price: 3 },
  },
  mercenary: {
    id: 'mercenary',
    name: 'Mercenary',
    combatClass: 'melee',
    prefers: Object.values(RECIPES)
      .filter((recipe) => (
        recipe.combatClass === 'melee'
        || recipe.category === 'rune'
        || ['strength_potion', 'attack_potion', 'anti_poison_potion', 'antifire_potion'].includes(recipe.id)
      ))
      .map((recipe) => recipe.id),
    patient: false,
    leaveIfEmpty: true,
    robe: 0x4a463f,
    accent: 0x8a6a3b,
    offer: { materialId: 'bronze', price: 4 },
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    combatClass: 'range',
    prefers: Object.values(RECIPES)
      .filter((recipe) => (
        recipe.combatClass === 'range'
        || recipe.category === 'rune'
        || ['ranging_potion', 'antifire_potion', 'energy_potion', 'anti_poison_potion'].includes(recipe.id)
      ))
      .map((recipe) => recipe.id),
    patient: true,
    leaveIfEmpty: false,
    robe: 0x3f4a32,
    accent: 0x7a5a32,
    offer: { materialId: 'hide', price: 5 },
  },
  hedgemage: {
    id: 'hedgemage',
    name: 'Hedge Mage',
    combatClass: 'magic',
    prefers: Object.values(RECIPES)
      .filter((recipe) => recipe.combatClass === 'magic' || ['magic_potion', 'prayer_potion'].includes(recipe.id))
      .map((recipe) => recipe.id),
    patient: false,
    leaveIfEmpty: false,
    robe: 0x3d5a4c,
    accent: 0x7b4ea0,
    offer: { materialId: 'cloth', price: 5 },
  },
  kingroald: {
    id: 'kingroald',
    name: 'King Roald',
    combatClass: null,
    prefers: [],
    patient: true,
    leaveIfEmpty: false,
    robe: 0x6a1c28,
    accent: 0xe3b34a,
    offer: null,
    special: true,
  },
};

export const SHOP = {
  door: { x: 0, z: 3.58 },
  outside: { x: 0, z: 5.55 },
  counter: { x: 0, z: -1.72 },
  keeper: { x: -0.48, z: -2.52 },
  anvil: { x: -3.2, z: -2.42 },
  // Floor, right of the counter, in the gap before the chest (not the back-left corner).
  range: { x: 1.92, z: -2.22 },
  chest: { x: 2.98, z: -2.42 },
  cauldron: { x: 0, z: 0.8 },
  furnace: { x: -2.12, z: -2.42 },
  wheel: { x: 1.2, z: 0.8 },
  queue: { x: 0, z: -0.82, gap: 0.88 },
  displays: [
    { id: 'left-front', name: 'Left Front Table', x: -2.95, z: 1.85, kind: 'table' },
    { id: 'right-front', name: 'Right Front Table', x: 2.95, z: 1.85, kind: 'table' },
    { id: 'left-mid', name: 'Left Table', x: -2.95, z: 0.35, kind: 'table' },
    { id: 'right-mid', name: 'Right Table', x: 2.95, z: 0.35, kind: 'table' },
    { id: 'shelf-left', name: 'Left Wall Shelf', x: -2.48, z: -3.22, kind: 'shelf' },
    { id: 'shelf-right', name: 'Right Wall Shelf', x: 2.48, z: -3.22, kind: 'shelf' },
    { id: 'stand-left', name: 'Left Armour Stand', x: -1.58, z: 2.68, kind: 'stand' },
    { id: 'stand-right', name: 'Right Armour Stand', x: 1.58, z: 2.68, kind: 'stand' },
    { id: 'shelf-center', name: 'Back Wall Shelf', x: 0, z: -3.22, kind: 'shelf' },
  ],
  cameraStart: { x: -0.15, y: 3.35, z: 2.85 },
  cameraTarget: { x: -0.85, y: 0.95, z: -1.35 },
};

export function emptySlots() {
  return { helm: null, body: null, legs: null, boots: null, gloves: null };
}

export function emptyShelfSlots() {
  return Array(SHELF_SLOT_COUNT).fill(null);
}

/** Positions relative to the top-board ware anchor on a wall shelf. */
export function shelfSlotPoses() {
  return [
    { x: -0.42, y: 0.02, z: 0.04 },
    { x: 0.42, y: 0.02, z: 0.04 },
    { x: -0.42, y: -0.44, z: 0.04 },
    { x: 0.42, y: -0.44, z: 0.04 },
  ];
}

export function nearestShelfSlot(localX, localY, localZ = 0) {
  const poses = shelfSlotPoses();
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < poses.length; i += 1) {
    const dx = localX - poses[i].x;
    const dy = localY - poses[i].y;
    const dz = localZ - poses[i].z;
    const dist = dx * dx + dy * dy + dz * dz;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

export const MINE_YIELD = 5;
export const MINE_DURATION = 3.2;

export function isMinedMaterial(materialId) {
  return materialId === 'essence' || METALS.some((metal) => metal.id === materialId);
}

export function isAmmoRecipe(recipe) {
  return recipe?.category === 'ammo';
}

export function isShelfItem(recipe) {
  return Boolean(
    recipe?.shelfItem
    || recipe?.category === 'food'
    || recipe?.category === 'potion'
    || recipe?.category === 'rune'
    || recipe?.category === 'ammo'
    || recipe?.shape === 'bow_string'
    || recipe?.shape === 'bar',
  );
}

/** Wares that can sit on a table or 4-slot wall shelf (not armour stands). */
export function canDisplayOn(kind, recipe) {
  if (!recipe || recipe.outputMaterial) return false;
  if (kind === 'stand') return recipe.category === 'armour' || recipe.category === 'weapon';
  const gear = recipe.category === 'weapon' || recipe.category === 'armour';
  const ammoOrRune = recipe.category === 'rune' || recipe.category === 'ammo';
  const platter = recipe.category === 'food' || recipe.category === 'potion';
  if (kind === 'table') return gear || ammoOrRune;
  if (kind === 'shelf') return gear || ammoOrRune || platter;
  return false;
}

export function stationForRecipe(recipe) {
  if (!recipe) return 'anvil';
  if (recipe.category === 'food') return 'range';
  if (recipe.category === 'potion') return 'cauldron';
  if (recipe.category === 'smelt') return 'furnace';
  if (recipe.category === 'spin') return 'wheel';
  return 'anvil';
}

export function isMaterialCraft(recipe) {
  return Boolean(recipe?.outputMaterial);
}

export function anvilTabForRecipe(recipe) {
  if (recipe?.combatClass === 'magic') return 'magic';
  if (recipe?.combatClass === 'range') return 'ranged';
  return 'melee';
}

export function anvilSubtabForRecipe(recipe) {
  if (recipe?.category === 'armour') return 'armour';
  if (recipe?.category === 'ammo') return 'ammo';
  if (recipe?.category === 'rune') return 'rune';
  return 'weapon';
}

export function recipeList() {
  return Object.values(RECIPES);
}

export function materialList() {
  return Object.values(MATERIALS);
}

export function recipeCost(recipe) {
  if (!recipe) return { materials: {}, gold: 0 };
  if (recipe.cost) {
    return {
      materials: { ...recipe.cost.materials },
      gold: recipe.cost.gold ?? 0,
    };
  }
  if (recipe.material) {
    return { materials: { [recipe.material]: 1 }, gold: 0 };
  }
  return { materials: {}, gold: 0 };
}

export function recipesForTab(tabId, subtabId = null) {
  if (tabId === 'potion') return recipeList().filter((recipe) => recipe.category === 'potion');
  if (tabId === 'food') return recipeList().filter((recipe) => recipe.category === 'food');
  if (tabId === 'smelt') return recipeList().filter((recipe) => recipe.category === 'smelt');
  if (tabId === 'spin') return recipeList().filter((recipe) => recipe.category === 'spin');
  const combatClass = tabId === 'ranged' ? 'range' : tabId;
  const list = recipeList().filter((recipe) => recipe.combatClass === combatClass);
  if (subtabId === 'weapon' || subtabId === 'armour' || subtabId === 'ammo' || subtabId === 'rune') {
    return list.filter((recipe) => recipe.category === subtabId);
  }
  return list;
}

export function recipesInLine(lineId) {
  return recipeList()
    .filter((recipe) => recipe.lineId === lineId)
    .sort((a, b) => a.lineIndex - b.lineIndex);
}

export function recipeMatsLabel(recipe) {
  const cost = recipeCost(recipe);
  return Object.entries(cost.materials)
    .map(([id, n]) => `${MATERIALS[id]?.name ?? id} ×${n}`)
    .join(' · ');
}

/** Commas for prices of 1000 or more; smaller amounts stay plain. */
export function formatGold(n) {
  const v = Math.round(Number(n) || 0);
  const abs = Math.abs(v);
  const formatted = abs >= 1000 ? abs.toLocaleString('en-US') : String(abs);
  return v < 0 ? `-${formatted}` : formatted;
}

export function costLabel(recipe, duration = recipe?.time) {
  const cost = recipeCost(recipe);
  const mats = recipeMatsLabel(recipe);
  const gold = cost.gold ? ` + ${formatGold(cost.gold)}g` : '';
  const time = Number.isFinite(duration) ? duration : recipe.time;
  const timeText = Number.isInteger(time) ? `${time}s` : `${time.toFixed(1)}s`;
  const yieldText = (recipe.outputCount ?? 1) > 1 && !recipe.outputMaterial
    ? ` · ×${recipe.outputCount}`
    : '';
  return `${mats}${gold}${yieldText} · ${timeText} · sells ${formatGold(recipe.price)}g`;
}

/** Offer/trade class: melee, ranged, magic, food, or potion. */
export function offerClassOf(recipe) {
  if (!recipe) return null;
  if (recipe.category === 'food') return 'food';
  if (recipe.category === 'potion') return 'potion';
  if (recipe.combatClass === 'melee') return 'melee';
  if (recipe.combatClass === 'range') return 'ranged';
  if (recipe.combatClass === 'magic') return 'magic';
  return null;
}

export function offerClassLabel(cls) {
  if (cls === 'melee') return 'Melee';
  if (cls === 'ranged') return 'Ranged';
  if (cls === 'magic') return 'Magic';
  if (cls === 'food') return 'Food';
  if (cls === 'potion') return 'Potion';
  return 'matching';
}

export function classLabel(combatClass, category = null) {
  if (category === 'potion') return 'Potion';
  if (category === 'rune') return 'Magic';
  if (category === 'food' || (!combatClass && category !== 'weapon' && category !== 'armour' && category !== 'ammo' && category !== 'rune')) return 'Food';
  if (combatClass === 'melee') return 'Melee';
  if (combatClass === 'range') return 'Ranged';
  if (combatClass === 'magic') return 'Magic';
  return 'Food';
}

export function displayKind(index, state) {
  return state?.displays?.[index]?.kind ?? SHOP.displays[index]?.kind ?? 'table';
}

export function matchingArmourIds(recipeId, ownedIds) {
  const recipe = RECIPES[recipeId];
  const slots = emptySlots();
  if (recipe?.category !== 'armour') return slots;
  const owned = ownedIds
    .map((id) => RECIPES[id])
    .filter((other) => (
      other?.category === 'armour'
      && other.combatClass === recipe.combatClass
      && other.setKey === recipe.setKey
      && ARMOUR_SLOTS.includes(other.slot)
    ));
  const rank = (other) => {
    if (other.id === recipeId) return 0;
    if (other.shape === 'full_helm' || other.shape === 'platebody' || other.shape === 'platelegs') return 1;
    return 2;
  };
  owned.sort((a, b) => rank(a) - rank(b));
  for (const other of owned) {
    if (!slots[other.slot]) slots[other.slot] = other.id;
  }
  if (ARMOUR_SLOTS.includes(recipe.slot)) slots[recipe.slot] = recipeId;
  return slots;
}

function recipeUnlocked(state, recipe) {
  if (!recipe) return false;
  if (!recipe.previousId) return true;
  if (!state) return true;
  const count = state.craftCounts?.[recipe.previousId] ?? 0;
  return count >= (recipe.unlockNeed ?? 0);
}

function pickWeighted(recipes, rng) {
  if (!recipes.length) return null;
  const weighted = [];
  for (const recipe of recipes) {
    const copies = (recipe.tier ?? 1) <= 1 ? 2 : 1;
    for (let i = 0; i < copies; i += 1) weighted.push(recipe);
  }
  return weighted[Math.floor(rng() * weighted.length)] ?? recipes[0];
}

export function mostExpensiveChestId(state) {
  let best = null;
  let bestPrice = -1;
  for (const [id, count] of Object.entries(state?.chest ?? {})) {
    if (!count) continue;
    const recipe = RECIPES[id];
    if (!recipe) continue;
    const price = recipe.price ?? 0;
    if (price > bestPrice) {
      bestPrice = price;
      best = id;
    }
  }
  return best;
}

export function scheduleKingRoald(fromSeconds, rng = Math.random) {
  const span = KING_ROALD_MAX - KING_ROALD_MIN;
  return fromSeconds + KING_ROALD_MIN + rng() * span;
}

export function decideRequest(customerId, rng = Math.random, state = null) {
  const customer = CUSTOMERS[customerId];
  if (customerId === 'kingroald') {
    const recipeId = mostExpensiveChestId(state);
    const recipe = RECIPES[recipeId];
    if (!recipe) return null;
    return {
      recipeId: recipe.id,
      gold: recipe.price,
      offer: null,
      royal: true,
    };
  }
  const preferred = customer.prefers
    .map((id) => RECIPES[id])
    .filter(Boolean)
    .filter((recipe) => recipe.category !== 'potion' || Boolean(state?.furniture?.cauldron));
  const unlocked = preferred.filter((recipe) => recipeUnlocked(state, recipe));
  const maxUnlockedPrice = unlocked.reduce((max, recipe) => Math.max(max, recipe.price ?? 0), 0);
  const maxUnlockedTier = unlocked.reduce((max, recipe) => Math.max(max, recipe.tier ?? 1), 0);
  const aspirational = preferred.filter((recipe) => {
    const locked = state ? !recipeUnlocked(state, recipe) : (recipe.tier ?? 1) > 1;
    const pricier = (recipe.price ?? 0) > maxUnlockedPrice;
    const higherTier = (recipe.tier ?? 1) > maxUnlockedTier;
    return locked || pricier || higherTier;
  });
  const nearby = aspirational.filter((recipe) => (recipe.tier ?? 1) <= Math.max(1, maxUnlockedTier) + 2);
  const aspirePool = nearby.length ? nearby : aspirational;
  const aspire = rng() < ASPIRE_CHANCE && aspirePool.length;
  const pool = aspire ? aspirePool : (unlocked.length ? unlocked : preferred);
  const recipe = pickWeighted(pool, rng);
  return {
    recipeId: recipe.id,
    gold: recipe.price,
    offer: customer.offer ?? null,
  };
}
