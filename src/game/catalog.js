/** Rune Craft catalog: melee, magic, range, and food lines. */

export const START_GOLD = 40;

export const OTHER_CHANCE = 0.18;
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

export const ANVIL_TABS = [
  { id: 'melee', label: 'Melee' },
  { id: 'magic', label: 'Magic' },
  { id: 'ranged', label: 'Ranged' },
  { id: 'potion', label: 'Potions' },
];

/** @deprecated Food moved to the cooking range; anvil uses ANVIL_TABS. */
export const CRAFT_TABS = ANVIL_TABS;

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
  bronze: { id: 'bronze', name: 'Bronze', restock: 3, start: 12, tier: 1, regenEvery: regenEvery(1) },
  iron: { id: 'iron', name: 'Iron', restock: 5, start: 2, tier: 2, regenEvery: regenEvery(2) },
  steel: { id: 'steel', name: 'Steel', restock: 7, start: 1, tier: 3, regenEvery: regenEvery(3) },
  mithril: { id: 'mithril', name: 'Mithril', restock: 10, start: 1, tier: 4, regenEvery: regenEvery(4) },
  adamant: { id: 'adamant', name: 'Adamant', restock: 13, start: 0, tier: 5, regenEvery: regenEvery(5) },
  runite: { id: 'runite', name: 'Runite', restock: 16, start: 0, tier: 6, regenEvery: regenEvery(6) },
  dragon: { id: 'dragon', name: 'Dragon', restock: 22, start: 0, tier: 7, regenEvery: regenEvery(7) },
  logs: { id: 'logs', name: 'Logs', restock: 4, start: 8, tier: 1, regenEvery: regenEvery(1) },
  string: { id: 'string', name: 'String', restock: 4, start: 6, tier: 1, regenEvery: regenEvery(1) },
  cloth: { id: 'cloth', name: 'Cloth', restock: 5, start: 8, tier: 1, regenEvery: regenEvery(1) },
  hide: { id: 'hide', name: 'Hide', restock: 5, start: 8, tier: 1, regenEvery: regenEvery(1) },
  egg: { id: 'egg', name: 'Egg', restock: 4, start: 4, tier: 1, regenEvery: regenEvery(1) },
  flour: { id: 'flour', name: 'Flour', restock: 3, start: 10, tier: 1, regenEvery: regenEvery(1) },
  pineapple: { id: 'pineapple', name: 'Pineapple', restock: 6, start: 3, tier: 1, regenEvery: regenEvery(1) },
  raspberry: { id: 'raspberry', name: 'Raspberry', restock: 6, start: 3, tier: 1, regenEvery: regenEvery(1) },
  fish: { id: 'fish', name: 'Fish', restock: 6, start: 3, tier: 1, regenEvery: regenEvery(1) },
};

export const ARMOUR_SLOTS = ['helm', 'body', 'legs', 'boots', 'gloves'];

export const RECIPES = {};

export function unlockNeed(lineIndex) {
  if (lineIndex <= 0) return 0;
  return UNLOCK_START + UNLOCK_STEP * (lineIndex - 1);
}

function addRecipe(recipe) {
  RECIPES[recipe.id] = recipe;
  return recipe;
}

function metalLine({ piece, category, combatClass, buyers, extraMats = {}, gold0 = 0, time0 = 3, price0 = 10 }) {
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
        materials: { [metal.id]: piece.metalCost ?? 1, ...extraMats },
        gold: gold0 + index * 2,
      },
      time: time0 + index,
      price: price0 + index * 8,
      buyers,
      tint: metal.tint,
    });
  });
}

const MELEE_WEAPONS = [
  { id: 'scimitar', name: 'Scimitar', slot: 'scimitar', shape: 'scimitar' },
  { id: 'dagger', name: 'Dagger', slot: 'dagger', shape: 'dagger' },
  { id: 'sword', name: 'Sword', slot: 'sword', shape: 'sword' },
  { id: 'mace', name: 'Mace', slot: 'mace', shape: 'mace' },
  { id: 'spear', name: 'Spear', slot: 'spear', shape: 'spear' },
  { id: '2h_sword', name: '2h Sword', slot: '2h', shape: '2h' },
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
  { id: 'shortbow', name: 'Shortbow', slot: 'bow', shape: 'shortbow', extra: { logs: 1, string: 1 } },
  { id: 'longbow', name: 'Longbow', slot: 'bow', shape: 'longbow', extra: { logs: 1, string: 1 } },
  { id: 'crossbow', name: 'Crossbow', slot: 'bow', shape: 'crossbow', extra: { logs: 1 } },
  { id: 'knives', name: 'Knives', slot: 'thrown', shape: 'knives' },
  { id: 'thrownaxe', name: 'Thrownaxe', slot: 'thrown', shape: 'thrownaxe' },
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

const DHIDE_PIECES = [
  { id: 'body', name: 'body', slot: 'body', shape: 'dhide_body' },
  { id: 'chaps', name: 'chaps', slot: 'legs', shape: 'dhide_chaps' },
  { id: 'vambraces', name: 'vambraces', slot: 'gloves', shape: 'dhide_vambraces' },
  { id: 'boots', name: 'boots', slot: 'boots', shape: 'dhide_boots' },
];

DHIDE.forEach((color, index) => {
  for (const piece of DHIDE_PIECES) {
    const id = `${color.id}_dhide_${piece.id}`;
    const previousId = index === 0 ? null : `${DHIDE[index - 1].id}_dhide_${piece.id}`;
    addRecipe({
      id,
      name: `${color.name} d'hide ${piece.name}`,
      category: 'armour',
      combatClass: 'range',
      slot: piece.slot,
      shape: piece.shape,
      setKey: `${color.id}-dhide`,
      lineId: `range-dhide-${piece.id}`,
      lineName: `d'hide ${piece.name}`,
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
  { id: 'hat', name: 'hat', slot: 'helm', shape: 'wizard_hat' },
  { id: 'robe_top', name: 'robe top', slot: 'body', shape: 'robe_top' },
  { id: 'robe_bottom', name: 'robe bottom', slot: 'legs', shape: 'robe_bottom' },
  { id: 'boots', name: 'boots', slot: 'boots', shape: 'magic_boots' },
  { id: 'gloves', name: 'gloves', slot: 'gloves', shape: 'magic_gloves' },
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

const FOOD_LINE = [
  { id: 'bread', name: 'Bread', mats: { flour: 1 }, tint: 0xc4a05a },
  { id: 'pizza', name: 'Pizza', mats: { flour: 1, pineapple: 1 }, tint: 0xd4a04a },
  { id: 'cake', name: 'Cake', mats: { flour: 1, egg: 1 }, tint: 0xe8c8a0 },
  { id: 'pie', name: 'Pie', mats: { flour: 1, raspberry: 1 }, tint: 0xb45a4a },
  { id: 'fish_pie', name: 'Fish pie', mats: { flour: 1, fish: 1 }, tint: 0xc8b07a },
];

// Food is small and sits on wall shelves. Potions will share these shelves later; do not build potions now.
FOOD_LINE.forEach((food, index) => {
  const previousId = index === 0 ? null : FOOD_LINE[index - 1].id;
  addRecipe({
    id: food.id,
    name: food.name,
    category: 'food',
    combatClass: null,
    slot: 'food',
    shape: food.id,
    setKey: 'kitchen',
    lineId: 'food-bake',
    lineName: 'Kitchen',
    lineIndex: index,
    previousId,
    unlockNeed: unlockNeed(index),
    tier: index + 1,
    cost: { materials: { ...food.mats }, gold: 0 },
    time: 3 + index,
    price: 8 + index * 6,
    buyers: ['pilgrim'],
    tint: food.tint,
    shelfItem: true,
  });
});

export const CUSTOMERS = {
  pilgrim: {
    id: 'pilgrim',
    name: 'Pilgrim',
    combatClass: null,
    prefers: FOOD_LINE.map((food) => food.id),
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
      .filter((recipe) => recipe.combatClass === 'melee')
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
      .filter((recipe) => recipe.combatClass === 'range')
      .map((recipe) => recipe.id),
    patient: true,
    leaveIfEmpty: false,
    robe: 0x3f4a32,
    accent: 0x7a5a32,
    offer: { materialId: 'hide', price: 5 },
  },
  hedgemage: {
    id: 'hedgemage',
    name: 'Hedge mage',
    combatClass: 'magic',
    prefers: Object.values(RECIPES)
      .filter((recipe) => recipe.combatClass === 'magic')
      .map((recipe) => recipe.id),
    patient: false,
    leaveIfEmpty: false,
    robe: 0x3d5a4c,
    accent: 0x7b4ea0,
    offer: { materialId: 'cloth', price: 5 },
  },
};

export const SHOP = {
  door: { x: 0, z: 3.58 },
  outside: { x: 0, z: 5.55 },
  counter: { x: 0, z: -1.72 },
  keeper: { x: -0.48, z: -2.52 },
  anvil: { x: -2.98, z: -2.42 },
  range: { x: 1.18, z: -2.52 },
  chest: { x: 2.98, z: -2.42 },
  queue: { x: 0, z: -0.82, gap: 0.88 },
  displays: [
    { id: 'left-front', name: 'Left front table', x: -2.95, z: 1.85, kind: 'table' },
    { id: 'right-front', name: 'Right front table', x: 2.95, z: 1.85, kind: 'table' },
    { id: 'left-mid', name: 'Left table', x: -2.95, z: 0.35, kind: 'table' },
    { id: 'right-mid', name: 'Right table', x: 2.95, z: 0.35, kind: 'table' },
    { id: 'shelf-left', name: 'Left wall shelf', x: -2.48, z: -3.22, kind: 'shelf' },
    { id: 'shelf-right', name: 'Right wall shelf', x: 2.48, z: -3.22, kind: 'shelf' },
    { id: 'stand-left', name: 'Left armour stand', x: -1.58, z: 2.68, kind: 'stand', rot: 0.42 },
    { id: 'stand-right', name: 'Right armour stand', x: 1.58, z: 2.68, kind: 'stand', rot: -0.42 },
  ],
  cameraStart: { x: -0.15, y: 3.35, z: 2.85 },
  cameraTarget: { x: -0.85, y: 0.95, z: -1.35 },
};

export function emptySlots() {
  return { helm: null, body: null, legs: null, boots: null, gloves: null };
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

export function recipesForTab(tabId) {
  if (tabId === 'potion') return [];
  if (tabId === 'food') return recipeList().filter((recipe) => recipe.category === 'food');
  if (tabId === 'ranged') return recipeList().filter((recipe) => recipe.combatClass === 'range');
  return recipeList().filter((recipe) => recipe.combatClass === tabId);
}

export function recipesInLine(lineId) {
  return recipeList()
    .filter((recipe) => recipe.lineId === lineId)
    .sort((a, b) => a.lineIndex - b.lineIndex);
}

export function costLabel(recipe) {
  const cost = recipeCost(recipe);
  const mats = Object.entries(cost.materials)
    .map(([id, n]) => `${n} ${MATERIALS[id]?.name ?? id}`)
    .join(' + ');
  const gold = cost.gold ? ` + ${cost.gold}g` : '';
  return `${mats}${gold} · ${recipe.time}s · sells ${recipe.price}g`;
}

export function classLabel(combatClass) {
  if (combatClass === 'melee') return 'Melee';
  if (combatClass === 'range') return 'Ranged';
  if (combatClass === 'magic') return 'Magic';
  return 'Food';
}

export function displayKind(index) {
  return SHOP.displays[index]?.kind ?? 'table';
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

export function decideRequest(customerId, rng = Math.random) {
  const customer = CUSTOMERS[customerId];
  const weighted = [];
  for (const id of customer.prefers) {
    const tier = RECIPES[id]?.tier ?? 1;
    const copies = tier === 1 ? 5 : tier === 2 ? 3 : tier === 3 ? 2 : 1;
    for (let i = 0; i < copies; i += 1) weighted.push(id);
  }
  const recipeId = weighted[Math.floor(rng() * weighted.length)];
  return {
    recipeId,
    gold: RECIPES[recipeId].price,
    offer: customer.offer ?? null,
  };
}
