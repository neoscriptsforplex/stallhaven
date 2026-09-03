/** Stallhaven catalog: original roadside-market recipes and travelers. */

export const START_GOLD = 40;

export const OTHER_CHANCE = 0.18;
export const MAX_CUSTOMERS = 2;
export const FIRST_CUSTOMER_DELAY = 4;
export const SPAWN_GAP_MIN = 7;
export const SPAWN_GAP_MAX = 13;
export const PATIENT_WAIT = 9;
export const PATIENT_RECHECKS = 3;

export const MATERIALS = {
  grain: { id: 'grain', name: 'Grain', restock: 4, start: 5 },
  embercap: { id: 'embercap', name: 'Embercap', restock: 8, start: 3 },
  ironbark: { id: 'ironbark', name: 'Ironbark', restock: 10, start: 3 },
  woolspool: { id: 'woolspool', name: 'Woolspool', restock: 9, start: 3 },
};

export const RECIPES = {
  trailbread: {
    id: 'trailbread',
    name: 'Trailbread',
    material: 'grain',
    time: 8,
    price: 12,
    buyers: ['pilgrim'],
    tint: 0xc4a05a,
  },
  emberflask: {
    id: 'emberflask',
    name: 'Emberflask',
    material: 'embercap',
    time: 12,
    price: 22,
    buyers: ['hedgemage'],
    tint: 0xd4552a,
  },
  thornpike: {
    id: 'thornpike',
    name: 'Thornpike',
    material: 'ironbark',
    time: 16,
    price: 30,
    buyers: ['mercenary'],
    tint: 0x6a8f4e,
  },
  waycloak: {
    id: 'waycloak',
    name: 'Waycloak',
    material: 'woolspool',
    time: 14,
    price: 26,
    buyers: ['pilgrim', 'hedgemage'],
    tint: 0x4a5d6a,
  },
};

export const CUSTOMERS = {
  pilgrim: {
    id: 'pilgrim',
    name: 'Pilgrim',
    prefers: ['trailbread', 'waycloak'],
    patient: true,
    leaveIfEmpty: false,
    robe: 0xc8b48a,
    accent: 0x6b4e31,
  },
  mercenary: {
    id: 'mercenary',
    name: 'Mercenary',
    prefers: ['thornpike'],
    patient: false,
    leaveIfEmpty: true,
    robe: 0x4a463f,
    accent: 0x8a6a3b,
  },
  hedgemage: {
    id: 'hedgemage',
    name: 'Hedge mage',
    prefers: ['emberflask', 'waycloak'],
    patient: false,
    leaveIfEmpty: false,
    robe: 0x3d5a4c,
    accent: 0x7b4ea0,
  },
};

export const SHOP = {
  door: { x: 0, z: 3.15 },
  counter: { x: 0, z: -2.05 },
  browse: { x: 0.15, z: 2.15 },
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
