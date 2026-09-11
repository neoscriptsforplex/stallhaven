import { SHOP } from './catalog.js';

export const ROOM_W = 8.2;
export const ROOM_D = 7.1;

export const ORIGIN_FLOOR = { minX: -3.72, maxX: 3.72, minZ: -3.18, maxZ: 3.28 };

export const EXPANSION_PADS = [
  { id: 'back-left', gx: -1, gz: -1, label: 'Behind Left' },
  { id: 'back', gx: 0, gz: -1, label: 'Behind' },
  { id: 'back-right', gx: 1, gz: -1, label: 'Behind Right' },
  { id: 'left', gx: -1, gz: 0, label: 'Left' },
  { id: 'right', gx: 1, gz: 0, label: 'Right' },
];

export const FIRST_EXPANSION_COST = 10000;
export const EXPANSION_COST_MULT = 3;
export const MAX_EXPANSIONS = 5;

export const CHEST_SLOTS_START = 100;
export const CHEST_SLOTS_PER_LEVEL = 100;
export const CHEST_MAX_LEVEL = 10;
export const CHEST_UPGRADE_BASE = 500;
export const CHEST_UPGRADE_MULT = 3;

export const MATERIAL_CAP = 250;
export const FURNITURE_SNAP = 0.2;
export const FURNITURE_ROT_STEP = Math.PI / 12;
/** Shared default facing: +Z, toward the shop door / customer side. */
export const FURNITURE_FORWARD = 0;
export const SWAP_PRICE_RATIO = 0.65;
export const CAULDRON_COST = 10000;
/** Mid-tier station: between the spinning wheel (500) and the cauldron (10,000). */
export const FURNACE_COST = 3000;
export const WHEEL_COST = 500;
export const STATION_UNLOCKS = [
  { id: 'wheel', label: 'Spinning Wheel', cost: WHEEL_COST },
  { id: 'furnace', label: 'Furnace', cost: FURNACE_COST },
  { id: 'cauldron', label: 'Cauldron', cost: CAULDRON_COST },
];
export const FURNITURE_BUY_BASE = 500;
export const FURNITURE_BUY_MULT = 3;
export const FURNITURE_SHOP = [
  { type: 'table', kind: 'table', label: 'Table' },
  { type: 'mannequin', kind: 'stand', label: 'Mannequin' },
];

export const GRASS_PAD = 9;
export const FOUNTAIN = { x: 0, z: 8.85, radius: 0.7, apron: 1.42 };
export const PATH_HALF_W = 0.72;
export const PATH_START_Z = 4.22;
export const TRAPDOOR = { x: 3.35, z: 9.55 };

export function furnitureBuyCost(boughtCount = 0) {
  const n = Math.max(0, Math.round(Number(boughtCount) || 0));
  return FURNITURE_BUY_BASE * (FURNITURE_BUY_MULT ** n);
}

export function furnitureKindForType(type) {
  return FURNITURE_SHOP.find((item) => item.type === type)?.kind ?? 'table';
}

export function furnitureLabelForType(type) {
  return FURNITURE_SHOP.find((item) => item.type === type)?.label
    ?? (type === 'mannequin' ? 'Mannequin' : 'Table');
}

export function padById(id) {
  return EXPANSION_PADS.find((pad) => pad.id === id) ?? null;
}

export function expansionCost(ownedCount) {
  return FIRST_EXPANSION_COST * (EXPANSION_COST_MULT ** ownedCount);
}

export function chestSlots(level = 1) {
  const lv = Math.min(CHEST_MAX_LEVEL, Math.max(1, level));
  return CHEST_SLOTS_START + (lv - 1) * CHEST_SLOTS_PER_LEVEL;
}

export function chestUpgradeCost(fromLevel) {
  return CHEST_UPGRADE_BASE * (CHEST_UPGRADE_MULT ** (fromLevel - 1));
}

export function occupiedCells(expansionIds = []) {
  const cells = [{ id: 'origin', gx: 0, gz: 0 }];
  for (const id of expansionIds) {
    const pad = padById(id);
    if (pad) cells.push({ id: pad.id, gx: pad.gx, gz: pad.gz });
  }
  return cells;
}

export function cellKey(gx, gz) {
  return `${gx},${gz}`;
}

export function occupiedKeys(expansionIds = []) {
  return new Set(occupiedCells(expansionIds).map((cell) => cellKey(cell.gx, cell.gz)));
}

export function roomCenter(gx, gz) {
  return { x: gx * ROOM_W, z: 0.1 + gz * ROOM_D };
}

export function roomFloor(gx, gz) {
  return {
    minX: ORIGIN_FLOOR.minX + gx * ROOM_W,
    maxX: ORIGIN_FLOOR.maxX + gx * ROOM_W,
    minZ: ORIGIN_FLOOR.minZ + gz * ROOM_D,
    maxZ: ORIGIN_FLOOR.maxZ + gz * ROOM_D,
  };
}

function doorwayBetween(a, b) {
  if (a.gx === b.gx && Math.abs(a.gz - b.gz) === 1) {
    const x = roomCenter(a.gx, a.gz).x;
    const z = (roomCenter(a.gx, a.gz).z + roomCenter(b.gx, b.gz).z) / 2;
    return { minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.55, maxZ: z + 0.55 };
  }
  if (a.gz === b.gz && Math.abs(a.gx - b.gx) === 1) {
    const z = roomCenter(a.gx, a.gz).z;
    const x = (roomCenter(a.gx, a.gz).x + roomCenter(b.gx, b.gz).x) / 2;
    return { minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.7, maxZ: z + 0.7 };
  }
  return null;
}

export function walkFloors(expansionIds = []) {
  const cells = occupiedCells(expansionIds);
  const floors = cells.map((cell) => roomFloor(cell.gx, cell.gz));
  for (let i = 0; i < cells.length; i += 1) {
    for (let j = i + 1; j < cells.length; j += 1) {
      const door = doorwayBetween(cells[i], cells[j]);
      if (door) floors.push(door);
    }
  }
  return floors;
}

const DOOR_HALF = 1.05;

/** Grass, path, and a door corridor wide enough for the player radius. */
export function outdoorWalkFloors(expansionIds = []) {
  const grass = gardenBox(expansionIds);
  const shop = footprintBox(expansionIds);
  const frontDoor = {
    minX: -DOOR_HALF,
    maxX: DOOR_HALF,
    minZ: ORIGIN_FLOOR.maxZ - 1.05,
    maxZ: Math.max(shop.maxZ + 1.45, PATH_START_Z + 1.15),
  };
  return [
    { minX: grass.minX, maxX: grass.maxX, minZ: shop.maxZ, maxZ: grass.maxZ },
    { minX: grass.minX, maxX: grass.maxX, minZ: grass.minZ, maxZ: shop.minZ },
    { minX: grass.minX, maxX: shop.minX, minZ: shop.minZ, maxZ: shop.maxZ },
    { minX: shop.maxX, maxX: grass.maxX, minZ: shop.minZ, maxZ: shop.maxZ },
    frontDoor,
  ];
}

export function playerWalkFloors(expansionIds = []) {
  return [...walkFloors(expansionIds), ...outdoorWalkFloors(expansionIds)];
}

export function stationUnlock(id) {
  return STATION_UNLOCKS.find((item) => item.id === id) ?? null;
}

export function stationLabel(id) {
  return stationUnlock(id)?.label
    ?? (id === 'wheel' ? 'Spinning Wheel' : id === 'furnace' ? 'Furnace' : id === 'cauldron' ? 'Cauldron' : furnitureLabelForType(id));
}

export function furnitureHalfSize(kind) {
  if (kind === 'cauldron') return { hw: 0.32, hd: 0.32 };
  if (kind === 'furnace') return { hw: 0.4, hd: 0.36 };
  if (kind === 'wheel') return { hw: 0.36, hd: 0.32 };
  if (kind === 'anvil') return { hw: 0.44, hd: 0.35 };
  if (kind === 'chest') return { hw: 0.49, hd: 0.36 };
  if (kind === 'range') return { hw: 0.34, hd: 0.28 };
  if (kind === 'counter') return { hw: 1.09, hd: 0.26 };
  if (kind === 'shelf') return { hw: 0.75, hd: 0.25 };
  if (kind === 'stand') return { hw: 0.36, hd: 0.36 };
  return { hw: 0.76, hd: 0.51 };
}

export function padConnects(pad, expansionIds = []) {
  const keys = occupiedKeys(expansionIds);
  const neigh = [
    cellKey(pad.gx - 1, pad.gz),
    cellKey(pad.gx + 1, pad.gz),
    cellKey(pad.gx, pad.gz - 1),
    cellKey(pad.gx, pad.gz + 1),
  ];
  return neigh.some((key) => keys.has(key));
}

export function neighborsOf(gx, gz, expansionIds = []) {
  const keys = occupiedKeys(expansionIds);
  return {
    left: keys.has(cellKey(gx - 1, gz)),
    right: keys.has(cellKey(gx + 1, gz)),
    back: keys.has(cellKey(gx, gz - 1)),
    front: keys.has(cellKey(gx, gz + 1)),
  };
}

export function defaultFurniture() {
  return {
    counter: { x: SHOP.counter.x, z: SHOP.counter.z, rot: FURNITURE_FORWARD },
    anvil: { x: SHOP.anvil.x, z: SHOP.anvil.z, rot: FURNITURE_FORWARD },
    chest: { x: SHOP.chest.x, z: SHOP.chest.z, rot: FURNITURE_FORWARD },
    range: { x: SHOP.range.x, z: SHOP.range.z, rot: FURNITURE_FORWARD },
    cauldron: null,
    furnace: null,
    wheel: null,
    displays: SHOP.displays.map((spot) => ({
      x: spot.x,
      z: spot.z,
      rot: FURNITURE_FORWARD,
    })),
  };
}

function clonePose(pose) {
  return pose ? { ...pose } : null;
}

export function cloneFurniture(furniture = defaultFurniture()) {
  const defaults = defaultFurniture();
  return {
    counter: { ...furniture.counter },
    anvil: { ...furniture.anvil },
    chest: { ...furniture.chest },
    range: { ...furniture.range },
    cauldron: clonePose(furniture.cauldron),
    furnace: clonePose(furniture.furnace),
    wheel: clonePose(furniture.wheel),
    displays: (furniture.displays ?? defaults.displays).map((pose) => ({ ...pose })),
  };
}

export function gardenBox(expansionIds = []) {
  const box = footprintBox(expansionIds);
  return {
    minX: box.minX - GRASS_PAD,
    maxX: box.maxX + GRASS_PAD,
    minZ: box.minZ - GRASS_PAD,
    maxZ: box.maxZ + GRASS_PAD,
    cx: (box.minX + box.maxX) / 2,
    cz: (box.minZ + box.maxZ) / 2,
  };
}

export function cobblePathSpan(expansionIds = []) {
  const grass = gardenBox(expansionIds);
  return {
    minX: -PATH_HALF_W,
    maxX: PATH_HALF_W,
    minZ: PATH_START_Z,
    maxZ: grass.maxZ - 0.16,
  };
}

export function pointHitsShop(x, z, expansionIds = [], pad = 1.15) {
  return occupiedCells(expansionIds).some((cell) => {
    const c = roomCenter(cell.gx, cell.gz);
    return x >= c.x - ROOM_W / 2 - pad
      && x <= c.x + ROOM_W / 2 + pad
      && z >= c.z - ROOM_D / 2 - pad
      && z <= c.z + ROOM_D / 2 + pad;
  });
}

export function pointOnPath(x, z, expansionIds = [], pad = 0.2) {
  const path = cobblePathSpan(expansionIds);
  const dx = x - FOUNTAIN.x;
  const dz = z - FOUNTAIN.z;
  const dist = Math.hypot(dx, dz);
  const apron = FOUNTAIN.apron ?? 1.42;
  if (dist <= FOUNTAIN.radius + 0.08) return false;
  if (dist <= apron + pad) return true;
  const onStrip = x >= path.minX - pad
    && x <= path.maxX + pad
    && z >= path.minZ - pad
    && z <= path.maxZ + pad;
  return onStrip;
}

export function footprintBox(expansionIds = []) {
  const cells = occupiedCells(expansionIds);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const cell of cells) {
    const c = roomCenter(cell.gx, cell.gz);
    minX = Math.min(minX, c.x - ROOM_W / 2);
    maxX = Math.max(maxX, c.x + ROOM_W / 2);
    minZ = Math.min(minZ, c.z - ROOM_D / 2);
    maxZ = Math.max(maxZ, c.z + ROOM_D / 2);
  }
  return { minX, maxX, minZ, maxZ };
}

/**
 * Exterior tree plan. Side trees must clear for side expansions: a left or
 * right room occupies the strip beside the origin shop, and trees there clip
 * through the new walls. Rear trees can stay unless they collide with a
 * back room.
 */
function keepGardenSpot(spot, expansionIds = []) {
  const hasLeft = expansionIds.includes('left');
  const hasRight = expansionIds.includes('right');
  if (spot.side === 'left' && hasLeft) return false;
  if (spot.side === 'right' && hasRight) return false;
  if (spot.side === 'front-left' && hasLeft) return false;
  if (spot.side === 'front-right' && hasRight) return false;
  if (pointHitsShop(spot.x, spot.z, expansionIds, 1.15)) return false;
  if (pointOnPath(spot.x, spot.z, expansionIds, 0.55)) return false;
  const dx = spot.x - FOUNTAIN.x;
  const dz = spot.z - FOUNTAIN.z;
  if ((dx * dx + dz * dz) < 1.55 ** 2) return false;
  return true;
}

export function gardenTreeSpots(expansionIds = []) {
  const box = footprintBox(expansionIds);
  const grass = gardenBox(expansionIds);
  const cx = (box.minX + box.maxX) / 2;
  const cz = (box.minZ + box.maxZ) / 2;
  const spots = [
    { x: box.minX - 2.2, z: box.minZ + 1.4, side: 'left' },
    { x: box.minX - 2.8, z: cz, side: 'left' },
    { x: box.minX - 1.8, z: box.maxZ - 1.2, side: 'left' },
    { x: box.maxX + 2.2, z: box.minZ + 1.4, side: 'right' },
    { x: box.maxX + 2.6, z: cz, side: 'right' },
    { x: box.maxX + 1.9, z: box.maxZ - 1.4, side: 'right' },
    { x: cx - 3.2, z: box.minZ - 2.4, side: 'rear' },
    { x: cx + 3.2, z: box.minZ - 2.4, side: 'rear' },
    { x: cx, z: box.minZ - 2.8, side: 'rear' },
    { x: box.minX - 1.6, z: box.maxZ + 2.4, side: 'front-left' },
    { x: box.maxX + 1.6, z: box.maxZ + 2.4, side: 'front-right' },
    { x: -2.55, z: 7.15, side: 'path' },
    { x: 2.62, z: 7.35, side: 'path' },
    { x: -2.85, z: 10.2, side: 'path' },
    { x: 2.95, z: 10.45, side: 'path' },
    { x: -2.15, z: 11.8, side: 'path' },
    { x: 2.25, z: 11.55, side: 'path' },
    { x: grass.minX + 1.4, z: grass.minZ + 1.6, side: 'edge' },
    { x: grass.maxX - 1.4, z: grass.minZ + 1.8, side: 'edge' },
    { x: grass.minX + 1.6, z: grass.maxZ - 1.5, side: 'edge' },
    { x: grass.maxX - 1.7, z: grass.maxZ - 1.6, side: 'edge' },
    { x: grass.minX + 2.2, z: cz, side: 'edge' },
    { x: grass.maxX - 2.1, z: cz, side: 'edge' },
    { x: cx - 5.4, z: grass.minZ + 1.3, side: 'edge' },
    { x: cx + 5.6, z: grass.minZ + 1.4, side: 'edge' },
  ];
  return spots.filter((spot) => keepGardenSpot(spot, expansionIds));
}

export function gardenRockSpots(expansionIds = []) {
  const spots = [
    { x: -3.45, z: 8.15, scale: 0.85, side: 'path' },
    { x: 3.55, z: 7.65, scale: 1.05, side: 'path' },
    { x: -4.15, z: 11.1, scale: 0.7, side: 'path' },
    { x: 4.35, z: 10.7, scale: 0.9, side: 'path' },
    { x: -6.2, z: -5.4, scale: 1.15, side: 'rear' },
    { x: 6.4, z: -4.8, scale: 0.8, side: 'rear' },
    { x: -7.4, z: 2.2, scale: 0.95, side: 'left' },
    { x: 7.6, z: 1.6, scale: 1.1, side: 'right' },
  ];
  return spots.filter((spot) => keepGardenSpot(spot, expansionIds));
}

export function gardenTrapdoorSpot(expansionIds = []) {
  const spot = { ...TRAPDOOR, side: 'path' };
  return keepGardenSpot(spot, expansionIds) ? spot : null;
}

export function keepFountain(expansionIds = []) {
  return !pointHitsShop(FOUNTAIN.x, FOUNTAIN.z, expansionIds, 1.15);
}

/** Wall vines that stay off food/potion display shelves on the back wall. */
export function wallVineMounts(center = roomCenter(0, 0)) {
  const leftX = center.x - ROOM_W / 2 + 0.14;
  const rightX = center.x + ROOM_W / 2 - 0.14;
  const frontZ = center.z + ROOM_D / 2 - 0.14;
  return [
    { x: leftX, y: 1.92, z: center.z - 2.42, rotY: Math.PI / 2, wall: 'left' },
    { x: leftX, y: 1.78, z: center.z + 2.42, rotY: Math.PI / 2, wall: 'left' },
    { x: rightX, y: 1.92, z: center.z - 2.42, rotY: -Math.PI / 2, wall: 'right' },
    { x: rightX, y: 1.78, z: center.z + 2.42, rotY: -Math.PI / 2, wall: 'right' },
    { x: center.x - 3.05, y: 1.84, z: frontZ, rotY: Math.PI, wall: 'front' },
    { x: center.x + 3.05, y: 1.84, z: frontZ, rotY: Math.PI, wall: 'front' },
  ];
}

export function rotatedFootprint(hw, hd, rot = 0) {
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  return {
    hw: hw * c + hd * s,
    hd: hw * s + hd * c,
  };
}

export function pointOnFloors(x, z, floors, pad = 0) {
  return floors.some((rect) => (
    x >= rect.minX + pad
    && x <= rect.maxX - pad
    && z >= rect.minZ + pad
    && z <= rect.maxZ - pad
  ));
}

export function snapToFloor(x, z, floors, margin = 0.55) {
  const sx = Math.round(x / FURNITURE_SNAP) * FURNITURE_SNAP;
  const sz = Math.round(z / FURNITURE_SNAP) * FURNITURE_SNAP;
  if (pointOnFloors(sx, sz, floors, margin)) return { x: sx, z: sz };
  let best = null;
  let bestDist = Infinity;
  for (const rect of floors) {
    const nx = Math.min(rect.maxX - margin, Math.max(rect.minX + margin, sx));
    const nz = Math.min(rect.maxZ - margin, Math.max(rect.minZ + margin, sz));
    const dist = Math.hypot(nx - sx, nz - sz);
    if (dist < bestDist && pointOnFloors(nx, nz, floors, margin * 0.5)) {
      best = {
        x: Math.round(nx / FURNITURE_SNAP) * FURNITURE_SNAP,
        z: Math.round(nz / FURNITURE_SNAP) * FURNITURE_SNAP,
      };
      bestDist = dist;
    }
  }
  return best ?? { x: sx, z: sz };
}

export function rotatePose(pose, steps = 1) {
  const rot = (pose.rot ?? 0) + FURNITURE_ROT_STEP * steps;
  const tau = Math.PI * 2;
  let wrapped = rot % tau;
  if (wrapped > Math.PI) wrapped -= tau;
  if (wrapped < -Math.PI) wrapped += tau;
  return { ...pose, rot: wrapped };
}

export function emptyMaterialAcc(materials) {
  const acc = {};
  for (const id of Object.keys(materials)) acc[id] = 0;
  return acc;
}
