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

export const FIRST_EXPANSION_COST = 500;
export const EXPANSION_COST_MULT = 5;

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
export const CAULDRON_COST = 20000;

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
    displays: (furniture.displays ?? defaults.displays).map((pose) => ({ ...pose })),
  };
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
export function gardenTreeSpots(expansionIds = []) {
  const box = footprintBox(expansionIds);
  const cx = (box.minX + box.maxX) / 2;
  const cz = (box.minZ + box.maxZ) / 2;
  const hasLeft = expansionIds.includes('left');
  const hasRight = expansionIds.includes('right');
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
  ];
  return spots.filter((spot) => {
    if (Math.abs(spot.x) < 2.4 && spot.z > 4.2) return false;
    if (spot.side === 'left' && hasLeft) return false;
    if (spot.side === 'right' && hasRight) return false;
    if (spot.side === 'front-left' && hasLeft) return false;
    if (spot.side === 'front-right' && hasRight) return false;
    const rooms = occupiedCells(expansionIds);
    const pad = 1.15;
    return !rooms.some((cell) => {
      const c = roomCenter(cell.gx, cell.gz);
      return spot.x >= c.x - ROOM_W / 2 - pad
        && spot.x <= c.x + ROOM_W / 2 + pad
        && spot.z >= c.z - ROOM_D / 2 - pad
        && spot.z <= c.z + ROOM_D / 2 + pad;
    });
  });
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
