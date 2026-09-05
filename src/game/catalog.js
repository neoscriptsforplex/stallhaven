/** Stallhaven catalog: original roadside recipes, materials, and travelers. */

export const START_GOLD = 40;

export const OTHER_CHANCE = 0.18;
export const MAX_CUSTOMERS = 2;
export const FIRST_CUSTOMER_DELAY = 5;
export const SPAWN_GAP_MIN = 8;
export const SPAWN_GAP_MAX = 14;
export const PATIENT_WAIT = 9;
export const PATIENT_RECHECKS = 3;
export const REQUEST_WAIT = 58;

export const CRAFT_TABS = [
  { id: 'provision', label: 'Provisions' },
  { id: 'weapon', label: 'Arms' },
  { id: 'armour', label: 'Armour' },
];

export const MATERIALS = {
  grain: { id: 'grain', name: 'Grain', restock: 4, start: 5 },
  embercap: { id: 'embercap', name: 'Embercap', restock: 8, start: 3 },
  ironbark: { id: 'ironbark', name: 'Ironbark', restock: 10, start: 3 },
  woolspool: { id: 'woolspool', name: 'Woolspool', restock: 9, start: 3 },
  dulliron: { id: 'dulliron', name: 'Dulliron', restock: 6, start: 3 },
  brightsteel: { id: 'brightsteel', name: 'Brightsteel', restock: 10, start: 2 },
  starvein: { id: 'starvein', name: 'Starvein', restock: 16, start: 1 },
  bowheart: { id: 'bowheart', name: 'Bowheart', restock: 7, start: 3 },
  moonstring: { id: 'moonstring', name: 'Moonstring', restock: 8, start: 2 },
  gleamcrystal: { id: 'gleamcrystal', name: 'Gleamcrystal', restock: 12, start: 2 },
  hideleather: { id: 'hideleather', name: 'Hideleather', restock: 7, start: 3 },
  platescrap: { id: 'platescrap', name: 'Platescrap', restock: 7, start: 3 },
  veilsilk: { id: 'veilsilk', name: 'Veilsilk', restock: 9, start: 2 },
};

export const RECIPES = {
  trailbread: {
    id: 'trailbread',
    name: 'Trailbread',
    category: 'provision',
    combatClass: null,
    slot: 'food',
    tier: 1,
    cost: { materials: { grain: 1 }, gold: 0 },
    time: 8,
    price: 12,
    buyers: ['pilgrim'],
    tint: 0xc4a05a,
  },
  emberflask: {
    id: 'emberflask',
    name: 'Emberflask',
    category: 'provision',
    combatClass: 'magic',
    slot: 'flask',
    tier: 1,
    cost: { materials: { embercap: 1 }, gold: 0 },
    time: 12,
    price: 22,
    buyers: ['hedgemage'],
    tint: 0xd4552a,
  },
  thornpike: {
    id: 'thornpike',
    name: 'Thornpike',
    category: 'weapon',
    combatClass: 'melee',
    slot: 'pike',
    tier: 1,
    cost: { materials: { ironbark: 1 }, gold: 0 },
    time: 16,
    price: 30,
    buyers: ['mercenary'],
    tint: 0x6a8f4e,
  },
  waycloak: {
    id: 'waycloak',
    name: 'Waycloak',
    category: 'provision',
    combatClass: null,
    slot: 'cloak',
    tier: 1,
    cost: { materials: { woolspool: 1 }, gold: 0 },
    time: 14,
    price: 26,
    buyers: ['pilgrim', 'hedgemage'],
    tint: 0x4a5d6a,
  },

  ironedge: {
    id: 'ironedge',
    name: 'Ironedge',
    category: 'weapon',
    combatClass: 'melee',
    slot: 'sword',
    tier: 1,
    cost: { materials: { dulliron: 1 }, gold: 3 },
    time: 8,
    price: 20,
    buyers: ['mercenary'],
    tint: 0x8a9098,
  },
  steelcleaver: {
    id: 'steelcleaver',
    name: 'Steelcleaver',
    category: 'weapon',
    combatClass: 'melee',
    slot: 'sword',
    tier: 2,
    cost: { materials: { brightsteel: 1, dulliron: 1 }, gold: 6 },
    time: 12,
    price: 38,
    buyers: ['mercenary'],
    tint: 0xb8c0c8,
  },
  starfang: {
    id: 'starfang',
    name: 'Starfang',
    category: 'weapon',
    combatClass: 'melee',
    slot: 'sword',
    tier: 3,
    cost: { materials: { starvein: 1, brightsteel: 1 }, gold: 10 },
    time: 16,
    price: 62,
    buyers: ['mercenary'],
    tint: 0x6ec8c0,
  },

  ashlong: {
    id: 'ashlong',
    name: 'Ashlong',
    category: 'weapon',
    combatClass: 'range',
    slot: 'bow',
    tier: 1,
    cost: { materials: { bowheart: 1 }, gold: 3 },
    time: 8,
    price: 20,
    buyers: ['ranger'],
    tint: 0x8a6238,
  },
  heartstring: {
    id: 'heartstring',
    name: 'Heartstring',
    category: 'weapon',
    combatClass: 'range',
    slot: 'bow',
    tier: 2,
    cost: { materials: { bowheart: 1, moonstring: 1 }, gold: 6 },
    time: 12,
    price: 36,
    buyers: ['ranger'],
    tint: 0xc48a48,
  },
  skysplit: {
    id: 'skysplit',
    name: 'Skysplit',
    category: 'weapon',
    combatClass: 'range',
    slot: 'bow',
    tier: 3,
    cost: { materials: { bowheart: 1, moonstring: 1, gleamcrystal: 1 }, gold: 10 },
    time: 16,
    price: 60,
    buyers: ['ranger'],
    tint: 0xd4c878,
  },

  emberrod: {
    id: 'emberrod',
    name: 'Emberrod',
    category: 'weapon',
    combatClass: 'magic',
    slot: 'staff',
    tier: 1,
    cost: { materials: { embercap: 1, ironbark: 1 }, gold: 3 },
    time: 8,
    price: 22,
    buyers: ['hedgemage'],
    tint: 0xd4552a,
  },
  gleamstave: {
    id: 'gleamstave',
    name: 'Gleamstave',
    category: 'weapon',
    combatClass: 'magic',
    slot: 'staff',
    tier: 2,
    cost: { materials: { gleamcrystal: 1, ironbark: 1 }, gold: 6 },
    time: 12,
    price: 40,
    buyers: ['hedgemage'],
    tint: 0x7b6cff,
  },
  veilstaff: {
    id: 'veilstaff',
    name: 'Veilstaff',
    category: 'weapon',
    combatClass: 'magic',
    slot: 'staff',
    tier: 3,
    cost: { materials: { gleamcrystal: 1, veilsilk: 1 }, gold: 10 },
    time: 16,
    price: 64,
    buyers: ['hedgemage'],
    tint: 0xc9a8ff,
  },

  ironhelm: {
    id: 'ironhelm',
    name: 'Ironhelm',
    category: 'armour',
    combatClass: 'melee',
    slot: 'helm',
    tier: 1,
    cost: { materials: { platescrap: 1, dulliron: 1 }, gold: 4 },
    time: 10,
    price: 26,
    buyers: ['mercenary'],
    tint: 0x7a8088,
  },
  ironmail: {
    id: 'ironmail',
    name: 'Ironmail',
    category: 'armour',
    combatClass: 'melee',
    slot: 'body',
    tier: 1,
    cost: { materials: { platescrap: 2, dulliron: 1 }, gold: 6 },
    time: 14,
    price: 38,
    buyers: ['mercenary'],
    tint: 0x6a7078,
  },
  steelhelm: {
    id: 'steelhelm',
    name: 'Steelhelm',
    category: 'armour',
    combatClass: 'melee',
    slot: 'helm',
    tier: 2,
    cost: { materials: { platescrap: 1, brightsteel: 1 }, gold: 8 },
    time: 12,
    price: 44,
    buyers: ['mercenary'],
    tint: 0xc5ccd4,
  },
  steelmail: {
    id: 'steelmail',
    name: 'Steelmail',
    category: 'armour',
    combatClass: 'melee',
    slot: 'body',
    tier: 2,
    cost: { materials: { platescrap: 2, brightsteel: 1 }, gold: 10 },
    time: 16,
    price: 56,
    buyers: ['mercenary'],
    tint: 0xb0b8c0,
  },

  hidehood: {
    id: 'hidehood',
    name: 'Hidehood',
    category: 'armour',
    combatClass: 'range',
    slot: 'helm',
    tier: 1,
    cost: { materials: { hideleather: 1, woolspool: 1 }, gold: 4 },
    time: 10,
    price: 24,
    buyers: ['ranger'],
    tint: 0x6b4423,
  },
  hidevest: {
    id: 'hidevest',
    name: 'Hidevest',
    category: 'armour',
    combatClass: 'range',
    slot: 'body',
    tier: 1,
    cost: { materials: { hideleather: 2 }, gold: 6 },
    time: 12,
    price: 34,
    buyers: ['ranger'],
    tint: 0x8a5a32,
  },
  scoutcap: {
    id: 'scoutcap',
    name: 'Scoutcap',
    category: 'armour',
    combatClass: 'range',
    slot: 'helm',
    tier: 2,
    cost: { materials: { hideleather: 1, moonstring: 1 }, gold: 8 },
    time: 12,
    price: 40,
    buyers: ['ranger'],
    tint: 0x3d5a3a,
  },
  scoutcoat: {
    id: 'scoutcoat',
    name: 'Scoutcoat',
    category: 'armour',
    combatClass: 'range',
    slot: 'body',
    tier: 2,
    cost: { materials: { hideleather: 2, moonstring: 1 }, gold: 10 },
    time: 16,
    price: 52,
    buyers: ['ranger'],
    tint: 0x4a6a3c,
  },

  veilcirclet: {
    id: 'veilcirclet',
    name: 'Veilcirclet',
    category: 'armour',
    combatClass: 'magic',
    slot: 'helm',
    tier: 1,
    cost: { materials: { veilsilk: 1 }, gold: 4 },
    time: 10,
    price: 24,
    buyers: ['hedgemage'],
    tint: 0x7b4ea0,
  },
  veilrobe: {
    id: 'veilrobe',
    name: 'Veilrobe',
    category: 'armour',
    combatClass: 'magic',
    slot: 'body',
    tier: 1,
    cost: { materials: { veilsilk: 2, woolspool: 1 }, gold: 6 },
    time: 14,
    price: 36,
    buyers: ['hedgemage'],
    tint: 0x4a3560,
  },
  gleamcowl: {
    id: 'gleamcowl',
    name: 'Gleamcowl',
    category: 'armour',
    combatClass: 'magic',
    slot: 'helm',
    tier: 2,
    cost: { materials: { veilsilk: 1, gleamcrystal: 1 }, gold: 8 },
    time: 12,
    price: 44,
    buyers: ['hedgemage'],
    tint: 0x6a5cff,
  },
  gleamrobe: {
    id: 'gleamrobe',
    name: 'Gleamrobe',
    category: 'armour',
    combatClass: 'magic',
    slot: 'body',
    tier: 2,
    cost: { materials: { veilsilk: 2, gleamcrystal: 1 }, gold: 10 },
    time: 16,
    price: 58,
    buyers: ['hedgemage'],
    tint: 0x3d2f6a,
  },
};

export const CUSTOMERS = {
  pilgrim: {
    id: 'pilgrim',
    name: 'Pilgrim',
    combatClass: null,
    prefers: ['trailbread', 'trailbread', 'waycloak'],
    patient: true,
    leaveIfEmpty: false,
    robe: 0xc8b48a,
    accent: 0x6b4e31,
    offer: { materialId: 'grain', price: 3 },
  },
  mercenary: {
    id: 'mercenary',
    name: 'Mercenary',
    combatClass: 'melee',
    prefers: [
      'ironedge',
      'thornpike',
      'ironhelm',
      'ironmail',
      'steelcleaver',
      'steelhelm',
      'steelmail',
      'starfang',
    ],
    patient: false,
    leaveIfEmpty: true,
    robe: 0x4a463f,
    accent: 0x8a6a3b,
    offer: { materialId: 'dulliron', price: 5 },
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    combatClass: 'range',
    prefers: [
      'ashlong',
      'hidehood',
      'hidevest',
      'heartstring',
      'scoutcap',
      'scoutcoat',
      'skysplit',
    ],
    patient: true,
    leaveIfEmpty: false,
    robe: 0x3f4a32,
    accent: 0x7a5a32,
    offer: { materialId: 'hideleather', price: 5 },
  },
  hedgemage: {
    id: 'hedgemage',
    name: 'Hedge mage',
    combatClass: 'magic',
    prefers: [
      'emberrod',
      'emberflask',
      'veilcirclet',
      'veilrobe',
      'waycloak',
      'gleamstave',
      'gleamcowl',
      'gleamrobe',
      'veilstaff',
    ],
    patient: false,
    leaveIfEmpty: false,
    robe: 0x3d5a4c,
    accent: 0x7b4ea0,
    offer: { materialId: 'embercap', price: 6 },
  },
};

export const SHOP = {
  door: { x: 0, z: 3.15 },
  counter: { x: 0, z: -2.05 },
  browse: { x: 0.15, z: 2.15 },
  chest: { x: 2.28, z: -1.72 },
  displays: [
    { id: 'left', name: 'Left stall', x: -1.72, z: 1.48 },
    { id: 'right', name: 'Right stall', x: 1.72, z: 1.48 },
  ],
  cameraStart: { x: 0, y: 1.58, z: -1.42 },
  cameraTarget: { x: 0, y: 0.78, z: 1.12 },
};

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
  return recipeList().filter((recipe) => recipe.category === tabId);
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
  if (combatClass === 'range') return 'Range';
  if (combatClass === 'magic') return 'Magic';
  return 'Road';
}

export function decideRequest(customerId, rng = Math.random) {
  const customer = CUSTOMERS[customerId];
  const weighted = [];
  for (const id of customer.prefers) {
    const tier = RECIPES[id]?.tier ?? 1;
    const copies = tier === 1 ? 3 : tier === 2 ? 2 : 1;
    for (let i = 0; i < copies; i += 1) weighted.push(id);
  }
  const recipeId = weighted[Math.floor(rng() * weighted.length)];
  return {
    recipeId,
    gold: RECIPES[recipeId].price,
    offer: customer.offer ?? null,
  };
}
