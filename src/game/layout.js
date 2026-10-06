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

export const FIRST_EXPANSION_COST = 500000;
export const EXPANSION_COST_MULT = 3;
export const MAX_EXPANSIONS = 5;

export const CHEST_SLOTS_START = 100;
export const CHEST_SLOTS_PER_LEVEL = 100;
export const CHEST_MAX_LEVEL = 10;
export const CHEST_UPGRADE_BASE = 500;
export const CHEST_UPGRADE_MULT = 3;

export const MATERIAL_CAP = 250;
export const FURNITURE_SNAP = 0.2;
/** How far a floor snap/grid cell may sit inside the wall faces. */
export const FLOOR_SNAP_MARGIN = 0;
/** Stone wall thickness; interior faces sit half of this inside ROOM_W / ROOM_D. */
export const WALL_THICK = 0.16;
export const FURNITURE_ROT_STEP = Math.PI / 12;
/** Shared default facing: +Z, toward the shop door / customer side. */
export const FURNITURE_FORWARD = 0;

/** Yaw added by one furniture-menu Rotate click. Floor pieces 15°; shelves 90°. */
export function furnitureRotateDelta(kind) {
  return kind === 'shelf' ? Math.PI / 2 : FURNITURE_ROT_STEP;
}

/** Upright chest facing from before the bad X-axis tip. */
export const CHEST_UPRIGHT_YAW = Math.PI;
/** One 90° floor-furniture Rotate turn: six 15° clicks on world +Y. */
export const CHEST_YAW_CLOCKWISE = furnitureRotateDelta('chest') * 6;
/**
 * Start-only visual yaw around world +Y. Applied to the placed mesh and pick
 * (including async dump swaps), not stored in furniture.rot so queue / saves
 * stay on the gameplay facing.
 */
export const FURNITURE_START_YAW = {
  // Flush on the right interior wall: two 90° +Y turns from the door-wall
  // upright (visual yaw 0). Latch (dump local −X) faces into the room.
  // A single 90° turn swaps hw/hd and pulls the box off the stone face.
  chest: CHEST_UPRIGHT_YAW + CHEST_YAW_CLOCKWISE * 2,
  range: -Math.PI / 2,
  furnace: -Math.PI / 2,
  counter: Math.PI,
};

export function furnitureStartYaw(id) {
  return FURNITURE_START_YAW[id] ?? 0;
}

export function furnitureVisualYaw(id, poseRot = FURNITURE_FORWARD) {
  return (poseRot ?? FURNITURE_FORWARD) + furnitureStartYaw(id);
}
export const SWAP_PRICE_RATIO = 0.65;
export const CAULDRON_COST = 1000000;
export const WHEEL_COST = 100000;
export const LOOM_COST = 50000;
export const FLETCH_COST = 50000;
export const POTTER_COST = 50000;
export const FURNACE_COST = 0;
export const RANGE_COST = 0;
export const STATION_UNLOCKS = [
  { id: 'furnace', label: 'Furnace', cost: FURNACE_COST },
  { id: 'range', label: 'Cooking Range', cost: RANGE_COST },
  { id: 'loom', label: 'Loom', cost: LOOM_COST },
  { id: 'fletch', label: 'Fletching Bench', cost: FLETCH_COST },
  { id: 'potter', label: 'Potter Wheel', cost: POTTER_COST },
  { id: 'wheel', label: 'Spinning Wheel', cost: WHEEL_COST },
  { id: 'cauldron', label: 'Cauldron', cost: CAULDRON_COST },
];

/** Place a missing furnace on the starter back-wall spot. */
export function furnaceBesideAnvil(anvil = SHOP.anvil) {
  return {
    x: SHOP.furnace.x,
    z: SHOP.furnace.z,
    rot: anvil?.rot ?? FURNITURE_FORWARD,
  };
}
export const FURNITURE_BUY_BASE = 500;
export const FURNITURE_BUY_MULT = 3;
export const FURNITURE_SHOP = [
  { type: 'table', kind: 'table', label: 'Table' },
  { type: 'mannequin', kind: 'stand', label: 'Mannequin' },
  { type: 'shelf', kind: 'shelf', label: 'Shelf' },
];
/** How far a wall shelf sits past the walk-floor edge, toward the wall. */
export const SHELF_WALL_OUTSET = 0.04;
/**
 * Depth from an interior wall face to a flush wall-shelf origin.
 * Matches the existing side-wall sit (walk-floor edge + SHELF_WALL_OUTSET).
 */
export const SHELF_FROM_WALL = 0.26;
export const TREE_BED_CLEAR = 1.7;

/** Uniform scale for every outdoor pine, all axes, versus the pre-stretch fit. */
export const OUTDOOR_TREE_SCALE = 2;
/**
 * Bundled trunk column at the 2× fit, measured on the bark above the root fins.
 * Each planted pine can override this with its own measured radius.
 */
export const TREE_TRUNK_RADIUS = 0.18;
/**
 * Walk block for that column. Wide enough to keep a body off the bark, and
 * narrow enough that the chop stand can still reach it.
 */
export const TREE_WALK_BLOCK = TREE_TRUNK_RADIUS * 2 + 0.24;
/** Grass-click radius around a tree. Was 1.15 before the pines doubled. */
export const TREE_CLICK_RADIUS = 1.15 * OUTDOOR_TREE_SCALE;
/**
 * Horizontal half-extent of a scale-1 fitted pine crown, before per-tree
 * variation and the outdoor scale.
 */
export const TREE_CANOPY_UNIT = 0.66;
/** Garden pines vary uniformly by this much around the 2× fit. */
export const TREE_SCALE_SPREAD = 0.15;

/** Widest crown for a garden pine, including the ±15% size roll. */
export function treeCanopyRadius(side = 'left') {
  void side;
  return TREE_CANOPY_UNIT * (1 + TREE_SCALE_SPREAD) * OUTDOOR_TREE_SCALE;
}

/** Block width for a pine whose trunk column has this radius. */
export function treeWalkBlock(radius = TREE_TRUNK_RADIUS) {
  const r = Number.isFinite(radius) && radius > 0 ? radius : TREE_TRUNK_RADIUS;
  const pad = TREE_WALK_BLOCK - TREE_TRUNK_RADIUS * 2;
  return r * 2 + pad;
}

const plantedTrunkRadii = new Map();

function trunkKey(x, z) {
  return `${Number(x).toFixed(2)},${Number(z).toFixed(2)}`;
}

export function resetPlantedTrunks() {
  plantedTrunkRadii.clear();
}

export function notePlantedTrunk(x, z, radius) {
  const r = Number(radius);
  if (!Number.isFinite(r) || r <= 0) return;
  plantedTrunkRadii.set(trunkKey(x, z), r);
}

export function plantedTrunkRadius(x, z) {
  return plantedTrunkRadii.get(trunkKey(x, z)) ?? TREE_TRUNK_RADIUS;
}

export const GRASS_PAD = 9;
export const FOUNTAIN = { x: 0, z: 8.85, radius: 0.7, apron: 1.42 };
export const PATH_HALF_W = 0.72;
export const PATH_START_Z = 4.22;
export const TRAPDOOR = { x: 3.35, z: 9.55 };
/** Keep lawn blades (including lean) off the dark hatch opening; rim grass on the rock can stay. */
export const TRAPDOOR_HOLE_CLEAR = 0.96;
/** Drop whole lawn clusters whose scatter would still reach the hole. */
export const TRAPDOOR_CLUSTER_CLEAR = 1.22;
/** Shop plank / station floor plane. Bundled chests sit on this, not at y=0. */
export const SHOP_FURNITURE_FLOOR_Y = 0.09;
/**
 * Shop floor mesh. The slab is the room footprint; the boards are the walk
 * surface. Character feet use the board top, which sits above y=0.
 */
export const SHOP_FLOOR_SLAB = { thickness: 0.08, centerY: 0.04 };
export const SHOP_FLOOR_PLANK = {
  thickness: 0.025,
  centerY: 0.085,
  pitch: 0.28,
  gap: 0.03,
  insetX: 0.18,
};
/** Lawn and path height. Feet already rest here outdoors. */
export const OUTDOOR_GROUND_Y = 0;
/** Distance in front of the boards where the doorway eases up onto the floor. */
export const SHOP_DOOR_STEP = 0.46;

export function shopFloorTopY() {
  const plankTop = SHOP_FLOOR_PLANK.centerY + SHOP_FLOOR_PLANK.thickness / 2;
  const slabTop = SHOP_FLOOR_SLAB.centerY + SHOP_FLOOR_SLAB.thickness / 2;
  return Math.max(plankTop, slabTop);
}

/** Timber beam over the origin storefront. The door leaf meets its underside. */
export const SHOP_DOOR_LINTEL = { centerY: 2.52, height: 0.38 };

/** Opening the front door leaf fills: board top up to the lintel underside. */
export function shopDoorOpening() {
  const floorY = shopFloorTopY();
  const topY = SHOP_DOOR_LINTEL.centerY - SHOP_DOOR_LINTEL.height / 2;
  return { floorY, topY, height: topY - floorY };
}

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

/** Origin-room rug: walkable furniture. Never a nav block. */
export const SHOP_RUG = { w: 2.35, d: 1.55, y: 0.11, zOffset: 0.15 };

export function shopRugPose(gx = 0, gz = 0) {
  const c = roomCenter(gx, gz);
  return {
    x: c.x,
    z: c.z + SHOP_RUG.zOffset,
    y: SHOP_RUG.y,
    hw: SHOP_RUG.w / 2,
    hd: SHOP_RUG.d / 2,
  };
}

export function shopRugRect(gx = 0, gz = 0) {
  const pose = shopRugPose(gx, gz);
  return {
    minX: pose.x - pose.hw,
    maxX: pose.x + pose.hw,
    minZ: pose.z - pose.hd,
    maxZ: pose.z + pose.hd,
  };
}

export function roomFloor(gx, gz) {
  return {
    minX: ORIGIN_FLOOR.minX + gx * ROOM_W,
    maxX: ORIGIN_FLOOR.maxX + gx * ROOM_W,
    minZ: ORIGIN_FLOOR.minZ + gz * ROOM_D,
    maxZ: ORIGIN_FLOOR.maxZ + gz * ROOM_D,
  };
}

/** World XZ covered by one room's slab and floorboards, including the door lip. */
export function shopFloorFootprint(gx = 0, gz = 0) {
  const c = roomCenter(gx, gz);
  const slab = {
    minX: c.x - ROOM_W / 2,
    maxX: c.x + ROOM_W / 2,
    minZ: c.z - ROOM_D / 2,
    maxZ: c.z + ROOM_D / 2,
  };
  const { pitch, gap, insetX } = SHOP_FLOOR_PLANK;
  const count = Math.max(1, Math.ceil(ROOM_D / pitch));
  const depth = pitch - gap;
  const first = c.z - ROOM_D / 2 + pitch * 0.5;
  const last = first + (count - 1) * pitch;
  const half = depth / 2;
  const span = ROOM_W - insetX;
  return {
    minX: Math.min(slab.minX, c.x - span / 2),
    maxX: Math.max(slab.maxX, c.x + span / 2),
    minZ: Math.min(slab.minZ, first - half),
    maxZ: Math.max(slab.maxZ, last + half),
  };
}

export function shopFloorFootprints(expansionIds = []) {
  return occupiedCells(expansionIds).map((cell) => shopFloorFootprint(cell.gx, cell.gz));
}

const SHOP_FLOOR_SEAM = 0.45;

/** Overlap across a shared wall so the join between two rooms stays on the boards. */
function shopFloorSeam(a, b, top) {
  const besideX = a.gz === b.gz && Math.abs(a.gx - b.gx) === 1;
  const besideZ = a.gx === b.gx && Math.abs(a.gz - b.gz) === 1;
  if (!besideX && !besideZ) return null;
  const fa = shopFloorFootprint(a.gx, a.gz);
  const fb = shopFloorFootprint(b.gx, b.gz);
  if (besideZ) {
    const north = a.gz > b.gz ? fa : fb;
    const south = a.gz > b.gz ? fb : fa;
    const seam = (south.maxZ + north.minZ) / 2;
    return {
      minX: Math.max(fa.minX, fb.minX),
      maxX: Math.min(fa.maxX, fb.maxX),
      minZ: seam - SHOP_FLOOR_SEAM,
      maxZ: seam + SHOP_FLOOR_SEAM,
      top,
      id: `seam-${a.id}-${b.id}`,
    };
  }
  const east = a.gx > b.gx ? fa : fb;
  const west = a.gx > b.gx ? fb : fa;
  const seam = (west.maxX + east.minX) / 2;
  return {
    minX: seam - SHOP_FLOOR_SEAM,
    maxX: seam + SHOP_FLOOR_SEAM,
    minZ: Math.max(fa.minZ, fb.minZ),
    maxZ: Math.min(fa.maxZ, fb.maxZ),
    top,
    id: `seam-${a.id}-${b.id}`,
  };
}

/** One walkable board rect per owned room, plus the doorway pieces between them. */
export function shopFloorPieces(expansionIds = [], floorTop = shopFloorTopY()) {
  const cells = occupiedCells(expansionIds);
  const pieces = cells.map((cell) => ({
    ...shopFloorFootprint(cell.gx, cell.gz),
    top: floorTop,
    id: cell.id,
  }));
  for (let i = 0; i < cells.length; i += 1) {
    for (let j = i + 1; j < cells.length; j += 1) {
      const seam = shopFloorSeam(cells[i], cells[j], floorTop);
      if (seam) pieces.push(seam);
    }
  }
  return pieces;
}

/** True interior wall faces of a room (stone inner plane, before snap expansion). */
export function roomInteriorFloor(gx = 0, gz = 0) {
  const c = roomCenter(gx, gz);
  const inset = WALL_THICK / 2;
  return {
    minX: c.x - ROOM_W / 2 + inset,
    maxX: c.x + ROOM_W / 2 - inset,
    minZ: c.z - ROOM_D / 2 + inset,
    maxZ: c.z + ROOM_D / 2 - inset,
  };
}

/**
 * If the inward 0.2 snap cell leaves a visible strip to the wall, include the
 * next outward cell so the placement grid meets the wall the way the X sides do.
 */
function snapEdgeToWall(min, max, snap = FURNITURE_SNAP) {
  const lo = Math.ceil(min / snap - 1e-9) * snap;
  const hi = Math.floor(max / snap + 1e-9) * snap;
  const gap = snap * 0.25;
  return {
    min: (lo - min > gap) ? lo - snap : min,
    max: (max - hi > gap) ? hi + snap : max,
  };
}

function expandRectToSnapWalls(rect, snap = FURNITURE_SNAP) {
  const x = snapEdgeToWall(rect.minX, rect.maxX, snap);
  const z = snapEdgeToWall(rect.minZ, rect.maxZ, snap);
  return { minX: x.min, maxX: x.max, minZ: z.min, maxZ: z.max };
}

/** Placeable floor + snap grid, spanning to interior wall faces. */
export function roomPlaceFloor(gx = 0, gz = 0) {
  return expandRectToSnapWalls(roomInteriorFloor(gx, gz));
}

/** Interior wall-face rects (no snap expansion) — use these to draw the overlay. */
export function interiorFloors(expansionIds = []) {
  return floorsForCells(expansionIds, roomInteriorFloor);
}

/** How far a room-seam walk rect overlaps each room. Must exceed 2× player radius. */
export const DOORWAY_WALK_OVERLAP = 0.75;
const ROOM_SEAM_INSET = 0.18;

function doorwayBetween(fa, fb, a, b) {
  if (a.gx === b.gx && Math.abs(a.gz - b.gz) === 1) {
    const north = a.gz > b.gz ? fa : fb;
    const south = a.gz > b.gz ? fb : fa;
    return {
      minX: Math.max(fa.minX, fb.minX) + ROOM_SEAM_INSET,
      maxX: Math.min(fa.maxX, fb.maxX) - ROOM_SEAM_INSET,
      minZ: south.maxZ - DOORWAY_WALK_OVERLAP,
      maxZ: north.minZ + DOORWAY_WALK_OVERLAP,
    };
  }
  if (a.gz === b.gz && Math.abs(a.gx - b.gx) === 1) {
    const east = a.gx > b.gx ? fa : fb;
    const west = a.gx > b.gx ? fb : fa;
    return {
      minX: west.maxX - DOORWAY_WALK_OVERLAP,
      maxX: east.minX + DOORWAY_WALK_OVERLAP,
      minZ: Math.max(fa.minZ, fb.minZ) + ROOM_SEAM_INSET,
      maxZ: Math.min(fa.maxZ, fb.maxZ) - ROOM_SEAM_INSET,
    };
  }
  return null;
}

export function doorwayFloor(a, b) {
  return doorwayBetween(roomFloor(a.gx, a.gz), roomFloor(b.gx, b.gz), a, b);
}

function floorsForCells(expansionIds, roomFn) {
  const cells = occupiedCells(expansionIds);
  const floors = cells.map((cell) => roomFn(cell.gx, cell.gz));
  for (let i = 0; i < cells.length; i += 1) {
    for (let j = i + 1; j < cells.length; j += 1) {
      const door = doorwayBetween(
        roomFn(cells[i].gx, cells[i].gz),
        roomFn(cells[j].gx, cells[j].gz),
        cells[i],
        cells[j],
      );
      if (door) floors.push(door);
    }
  }
  return floors;
}

export function walkFloors(expansionIds = []) {
  return floorsForCells(expansionIds, roomFloor);
}

/** Placeable floor + snap grid, spanning to interior wall faces. */
export function placeFloors(expansionIds = []) {
  return floorsForCells(expansionIds, roomPlaceFloor);
}

const DOOR_HALF = 1.05;
/**
 * Side lawns overlap the front and rear lawns so a player-radius inset still
 * leaves a walkable corner. Without it the player cannot go around the shop.
 */
const OUTDOOR_CORNER_LINK = 1.15;

function smooth01(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function pointOnFloorPiece(x, z, piece) {
  return x >= piece.minX - 1e-4 && x <= piece.maxX + 1e-4
    && z >= piece.minZ - 1e-4 && z <= piece.maxZ + 1e-4;
}

/**
 * Feet height for the shop floor piece under (x, z). Owned rooms and the
 * doorway pieces between them each contribute their board top. Anywhere else
 * is outdoor ground, with a smooth step at the front door.
 */
export function characterGroundY(
  x,
  z,
  expansionIds = [],
  floorTop = shopFloorTopY(),
  outdoorY = OUTDOOR_GROUND_Y,
  step = SHOP_DOOR_STEP,
) {
  let stand = null;
  for (const piece of shopFloorPieces(expansionIds, floorTop)) {
    if (!pointOnFloorPiece(x, z, piece)) continue;
    stand = stand == null ? piece.top : Math.max(stand, piece.top);
  }
  if (stand != null) return stand;
  const front = shopFloorFootprint(0, 0).maxZ;
  const beyond = z - front;
  const inDoor = Math.abs(x - SHOP.door.x) <= DOOR_HALF;
  if (!inDoor || !(step > 0) || beyond <= 0 || beyond >= step - 1e-6) return outdoorY;
  const t = smooth01(1 - beyond / step);
  return outdoorY + (floorTop - outdoorY) * t;
}

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
  const sideMinZ = Math.max(grass.minZ, shop.minZ - OUTDOOR_CORNER_LINK);
  const sideMaxZ = Math.min(grass.maxZ, shop.maxZ + OUTDOOR_CORNER_LINK);
  // One lawn rect, not only the strips around the room box. An L-shaped
  // expansion leaves grass in the notch, and strip seams drop the corners.
  const lawn = { minX: grass.minX, maxX: grass.maxX, minZ: grass.minZ, maxZ: grass.maxZ };
  return [
    lawn,
    { minX: grass.minX, maxX: grass.maxX, minZ: shop.maxZ, maxZ: grass.maxZ },
    { minX: grass.minX, maxX: grass.maxX, minZ: grass.minZ, maxZ: shop.minZ },
    { minX: grass.minX, maxX: shop.minX, minZ: sideMinZ, maxZ: sideMaxZ },
    { minX: shop.maxX, maxX: grass.maxX, minZ: sideMinZ, maxZ: sideMaxZ },
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
    ?? (id === 'wheel' ? 'Spinning Wheel'
      : id === 'furnace' ? 'Furnace'
        : id === 'range' ? 'Cooking Range'
          : id === 'cauldron' ? 'Cauldron'
            : furnitureLabelForType(id));
}

export function furnitureHalfSize(kind) {
  if (kind === 'cauldron') return { hw: 0.32, hd: 0.32 };
  if (kind === 'furnace') return { hw: 0.4, hd: 0.36 };
  if (kind === 'wheel') return { hw: 0.72, hd: 0.64 };
  if (kind === 'anvil') return { hw: 0.22, hd: 0.175 };
  if (kind === 'chest') return { hw: 0.3, hd: 0.22 };
  if (kind === 'range') return { hw: 0.68, hd: 0.56 };
  if (kind === 'loom') return { hw: 0.48, hd: 0.36 };
  if (kind === 'fletch') return { hw: 0.55, hd: 0.4 };
  if (kind === 'potter') return { hw: 0.4, hd: 0.4 };
  if (kind === 'counter') return { hw: 1.09, hd: 0.26 };
  if (kind === 'shelf') return { hw: 0.75, hd: 0.25 };
  if (kind === 'stand') return { hw: 0.36, hd: 0.36 };
  if (kind === 'rug') return { hw: SHOP_RUG.w / 2, hd: SHOP_RUG.d / 2 };
  return { hw: 0.76, hd: 0.51 };
}

/** Axis-aligned footprint after start yaw + gameplay rot. */
export function poseRect(kind, pose) {
  const { hw, hd } = furnitureHalfSize(kind);
  const span = rotatedFootprint(hw, hd, furnitureVisualYaw(kind, pose?.rot));
  return {
    minX: pose.x - span.hw,
    maxX: pose.x + span.hw,
    minZ: pose.z - span.hd,
    maxZ: pose.z + span.hd,
  };
}

export function rectsOverlap(a, b, pad = 0) {
  if (!a || !b) return false;
  return !(
    a.maxX + pad < b.minX
    || a.minX - pad > b.maxX
    || a.maxZ + pad < b.minZ
    || a.minZ - pad > b.maxZ
  );
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
    range: null,
    cauldron: null,
    furnace: null,
    wheel: null,
    loom: null,
    fletch: null,
    potter: null,
    rug: { x: shopRugPose().x, z: shopRugPose().z, rot: FURNITURE_FORWARD },
    displays: SHOP.displays.map((spot) => (
      (spot.kind ?? 'table') === 'shelf'
        ? snapToWallGrid(spot.x, spot.z, [])
        : { x: spot.x, z: spot.z, rot: FURNITURE_FORWARD }
    )),
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
    range: clonePose(furniture.range),
    cauldron: clonePose(furniture.cauldron),
    furnace: clonePose(furniture.furnace),
    wheel: clonePose(furniture.wheel),
    loom: clonePose(furniture.loom),
    fletch: clonePose(furniture.fletch),
    potter: clonePose(furniture.potter),
    rug: { ...(furniture.rug ?? defaults.rug) },
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

/**
 * How far the straight path must run past the ring's outer tangent so both
 * side edges sit under the round cobble. The ring is wider than the path, so
 * stopping at the outer radius leaves a grass gap on each side.
 */
export function cobbleRingTuck(apron = FOUNTAIN.apron ?? 1.42, halfW = PATH_HALF_W) {
  const side = Math.sqrt(Math.max(0, apron * apron - halfW * halfW));
  return (apron - side) + 0.14;
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
 * Exterior decor plan. Side trees, grass, beds, and rocks must clear for
 * expansions: a left or right room occupies the strip beside the origin shop,
 * and foliage there clips through the new walls. Rear pieces stay unless they
 * collide with a back room, the path, or the fountain.
 */
export function keepGardenSpot(spot, expansionIds = []) {
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

export function gardenSpotClearOfBeds(spot, expansionIds = [], minDist = TREE_BED_CLEAR) {
  return gardenBedSpots(expansionIds).every((bed) => (
    Math.hypot(spot.x - bed.x, spot.z - bed.z) >= minDist
  ));
}

function treeSitRadius(side = 'left') {
  return side === 'edge' ? treeCanopyRadius('edge') : treeCanopyRadius('left');
}

/** Push a pine off boulders and neighbouring crowns. Loops are capped. */
function settleGardenTree(spot, others, rocks, grass) {
  const inset = treeSitRadius(spot.side);
  let x = spot.x;
  let z = spot.z;
  const clamp = () => {
    x = Math.min(grass.maxX - inset, Math.max(grass.minX + inset, x));
    z = Math.min(grass.maxZ - inset, Math.max(grass.minZ + inset, z));
  };
  clamp();
  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false;
    for (const rock of rocks) {
      const need = gardenRockRadius(rock.scale ?? 1) + 1.05;
      let dx = x - rock.x;
      let dz = z - rock.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= need) continue;
      if (dist < 1e-4) {
        dx = spot.x >= rock.x ? 1 : -1;
        dz = 0;
      }
      const push = (need - Math.max(dist, 1e-4)) + 0.04;
      const len = Math.hypot(dx, dz) || 1;
      x += (dx / len) * push;
      z += (dz / len) * push;
      moved = true;
    }
    const mine = treeSitRadius(spot.side);
    for (const other of others) {
      const need = (mine + treeSitRadius(other.side)) * 0.86;
      let dx = x - other.x;
      let dz = z - other.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= need) continue;
      if (dist < 1e-4) {
        dx = 1;
        dz = 0;
      }
      const push = (need - Math.max(dist, 1e-4)) * 0.5 + 0.02;
      const len = Math.hypot(dx, dz) || 1;
      x += (dx / len) * push;
      z += (dz / len) * push;
      moved = true;
    }
    clamp();
    if (!moved) break;
  }
  return { ...spot, x, z };
}

export function gardenTreeSpots(expansionIds = []) {
  const box = footprintBox(expansionIds);
  const grass = gardenBox(expansionIds);
  const cx = (box.minX + box.maxX) / 2;
  const cz = (box.minZ + box.maxZ) / 2;
  const spots = [
    { x: box.minX - 2.45, z: box.minZ + 1.5, side: 'left' },
    { x: box.minX - 2.9, z: cz - 0.2, side: 'left' },
    { x: box.minX - 2.2, z: box.maxZ - 0.45, side: 'left' },
    { x: box.maxX + 2.45, z: box.minZ + 1.35, side: 'right' },
    { x: box.maxX + 2.85, z: cz + 0.45, side: 'right' },
    { x: box.maxX + 2.2, z: box.maxZ - 0.7, side: 'right' },
    { x: cx - 3.6, z: box.minZ - 5.0, side: 'rear' },
    { x: cx + 3.6, z: box.minZ - 4.8, side: 'rear' },
    { x: cx, z: box.minZ - 3.15, side: 'rear' },
    { x: box.minX - 3.4, z: box.maxZ + 1.55, side: 'front-left' },
    { x: box.maxX + 3.4, z: box.maxZ + 1.7, side: 'front-right' },
    { x: -4.7, z: 6.2, side: 'path' },
    { x: 5.0, z: 6.0, side: 'path' },
    { x: -6.5, z: 8.7, side: 'path' },
    { x: 6.2, z: 8.2, side: 'path' },
    { x: -4.85, z: 10.45, side: 'path' },
    { x: 5.1, z: 10.5, side: 'path' },
    { x: grass.minX + 2.25, z: grass.minZ + 2.4, side: 'edge' },
    { x: grass.maxX - 2.25, z: grass.minZ + 2.55, side: 'edge' },
    { x: grass.minX + 2.25, z: grass.maxZ - 2.4, side: 'edge' },
    { x: grass.maxX - 2.25, z: grass.maxZ - 2.55, side: 'edge' },
    { x: grass.minX + 2.25, z: cz - 3.5, side: 'edge' },
    { x: grass.maxX - 2.25, z: cz + 3.3, side: 'edge' },
    { x: cx - 7.5, z: grass.minZ + 2.4, side: 'edge' },
    { x: cx + 7.7, z: grass.minZ + 2.5, side: 'edge' },
  ];
  const rocks = gardenRockSpots(expansionIds);
  const kept = [];
  for (const spot of spots) {
    const settled = settleGardenTree(spot, kept, rocks, grass);
    if (!keepGardenSpot(settled, expansionIds)) continue;
    if (!gardenSpotClearOfBeds(settled, expansionIds)) continue;
    const stillInRock = rocks.some((rock) => (
      Math.hypot(settled.x - rock.x, settled.z - rock.z) < gardenRockRadius(rock.scale ?? 1) + 0.45
    ));
    if (stillInRock) continue;
    kept.push(settled);
  }
  return kept;
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
    { x: -8.35, z: 7.85, scale: 2.35, side: 'left' },
    { x: 8.55, z: 8.35, scale: 2.8, side: 'right' },
    { x: 0.2, z: -7.35, scale: 2.95, side: 'rear' },
  ];
  return spots.filter((spot) => (
    keepGardenSpot(spot, expansionIds)
    && gardenSpotClearOfBeds(spot, expansionIds)
    && gardenRockOnGrass(spot, expansionIds)
  ));
}

/** Horizontal radius of the garden boulder mesh, plus a sit-on-lawn margin. */
export function gardenRockRadius(scale = 1) {
  return 0.32 * scale + 0.35;
}

function gardenRockOnGrass(spot, expansionIds = []) {
  const grass = gardenBox(expansionIds);
  const pad = gardenRockRadius(spot.scale ?? 1);
  return spot.x >= grass.minX + pad
    && spot.x <= grass.maxX - pad
    && spot.z >= grass.minZ + pad
    && spot.z <= grass.maxZ - pad;
}

/** Outdoor flax nodes. Picked plants leave and sprout again after a short delay. */
export const FLAX_COUNT = 20;
export const FLAX_SPACING = 1.2;
export const FLAX_RESPAWN_SEC = 6;
export const FLAX_CLICK_RADIUS = 0.72;

const FLAX_EDGE = 0.7;
/** Stay outside the doubled crown and the widened grass-click radius. */
const FLAX_TREE_CLEAR = Math.max(treeCanopyRadius('edge'), TREE_CLICK_RADIUS) + 0.25;
const FLAX_FLOWER_CLEAR = 0.34;
const FLAX_STATION_CLEAR = 1.45;
const FLAX_DISPLAY_CLEAR = 1.2;
const FLAX_TRAP_CLEAR = 1.25;
const FLAX_STATION_IDS = ['counter', 'anvil', 'chest', 'range', 'furnace', 'cauldron', 'wheel', 'loom', 'fletch', 'potter'];

export function flaxSpotBlocked(x, z, expansionIds = [], { occupied = [], furniture = null } = {}) {
  const grass = gardenBox(expansionIds);
  if (x < grass.minX + FLAX_EDGE || x > grass.maxX - FLAX_EDGE) return true;
  if (z < grass.minZ + FLAX_EDGE || z > grass.maxZ - FLAX_EDGE) return true;
  if (!keepGardenSpot({ x, z, side: 'edge' }, expansionIds)) return true;
  if (pointOnFloors(x, z, walkFloors(expansionIds), 0.4)) return true;
  if (pointHitsTrapdoor(x, z, FLAX_TRAP_CLEAR)) return true;
  for (const tree of gardenTreeSpots(expansionIds)) {
    if (Math.hypot(x - tree.x, z - tree.z) < FLAX_TREE_CLEAR) return true;
  }
  for (const rock of gardenRockSpots(expansionIds)) {
    if (Math.hypot(x - rock.x, z - rock.z) < gardenRockRadius(rock.scale ?? 1) + 0.3) return true;
  }
  for (const flower of gardenFlowerSpots(expansionIds)) {
    const reach = FLAX_FLOWER_CLEAR + (flower.scale ?? 1) * 0.16;
    if (Math.hypot(x - flower.x, z - flower.z) < reach) return true;
  }
  const furn = furniture ?? defaultFurniture();
  for (const id of FLAX_STATION_IDS) {
    const pose = furn[id];
    if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) continue;
    if (Math.hypot(x - pose.x, z - pose.z) < FLAX_STATION_CLEAR) return true;
  }
  for (const pose of furn.displays ?? []) {
    if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) continue;
    if (Math.hypot(x - pose.x, z - pose.z) < FLAX_DISPLAY_CLEAR) return true;
  }
  for (const other of occupied) {
    if (Math.hypot(x - other.x, z - other.z) < FLAX_SPACING) return true;
  }
  return false;
}

/** Random grass spots that stay off the shop, path, stations, and each other. */
export function rollFlaxSpots(expansionIds = [], opts = {}) {
  const count = Math.max(0, opts.count ?? FLAX_COUNT);
  const rng = opts.rng ?? Math.random;
  const furniture = opts.furniture ?? null;
  const occupied = opts.occupied ?? [];
  const grass = gardenBox(expansionIds);
  const spanX = Math.max(0.1, grass.maxX - grass.minX - FLAX_EDGE * 2);
  const spanZ = Math.max(0.1, grass.maxZ - grass.minZ - FLAX_EDGE * 2);
  const spots = [];
  const maxTries = Math.max(800, count * 200);
  for (let i = 0; i < maxTries && spots.length < count; i += 1) {
    const x = grass.minX + FLAX_EDGE + rng() * spanX;
    const z = grass.minZ + FLAX_EDGE + rng() * spanZ;
    if (flaxSpotBlocked(x, z, expansionIds, { occupied: [...occupied, ...spots], furniture })) continue;
    spots.push({ x, z });
  }
  return spots;
}

export function pickFlaxNode(nodes, id, now, delay = FLAX_RESPAWN_SEC) {
  const node = nodes.find((item) => item.id === id && item.alive);
  if (!node) return false;
  node.alive = false;
  node.respawnAt = now + delay;
  return true;
}

/** Grow back nodes whose delay has passed. `rollSpot` receives currently living positions. */
export function sproutDueFlax(nodes, now, rollSpot) {
  let changed = false;
  for (const node of nodes) {
    if (node.alive || !(now >= (node.respawnAt ?? 0))) continue;
    const occupied = nodes.filter((item) => item.alive).map((item) => ({ x: item.x, z: item.z }));
    const spot = rollSpot(occupied);
    if (!spot) continue;
    node.x = spot.x;
    node.z = spot.z;
    node.alive = true;
    node.respawnAt = 0;
    changed = true;
  }
  return changed;
}

export function gardenTrapdoorSpot(expansionIds = []) {
  const spot = { ...TRAPDOOR, side: 'path' };
  return keepGardenSpot(spot, expansionIds) ? spot : null;
}

export function pointHitsTrapdoor(x, z, pad = TRAPDOOR_HOLE_CLEAR) {
  return Math.hypot(x - TRAPDOOR.x, z - TRAPDOOR.z) < pad;
}

/** True if the segment from (x0,z0) to (x1,z1) comes within `pad` of the hatch. */
export function segmentHitsTrapdoor(x0, z0, x1, z1, pad = TRAPDOOR_HOLE_CLEAR) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len2 = dx * dx + dz * dz;
  let t = 0;
  if (len2 > 1e-8) {
    t = ((TRAPDOOR.x - x0) * dx + (TRAPDOOR.z - z0) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  return pointHitsTrapdoor(x0 + dx * t, z0 + dz * t, pad);
}

export const GARDEN_BED_SPOTS = [
  { x: 2.45, z: 6.2, side: 'path' },
  { x: -2.7, z: 7.6, side: 'path' },
  { x: -3.15, z: 10.6, side: 'path' },
  { x: 3.2, z: 11.15, side: 'path' },
];

export function gardenBedSpots(expansionIds = []) {
  return GARDEN_BED_SPOTS.filter((spot) => keepGardenSpot(spot, expansionIds));
}

const FLOWER_TINT_COUNT = 6;
const flowerSpotCache = new Map();

function flowerBlocked(x, z, expansionIds, trees, rocks) {
  const grass = gardenBox(expansionIds);
  const edge = 0.4;
  if (x < grass.minX + edge || x > grass.maxX - edge) return true;
  if (z < grass.minZ + edge || z > grass.maxZ - edge) return true;
  if (pointHitsShop(x, z, expansionIds, 0.55)) return true;
  if (pointOnFloors(x, z, walkFloors(expansionIds), 0)) return true;
  if (pointOnPath(x, z, expansionIds, 0.48)) return true;
  if (Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < (FOUNTAIN.apron ?? 1.42) + 0.3) return true;
  if (pointHitsTrapdoor(x, z, TRAPDOOR_HOLE_CLEAR + 0.28)) return true;
  const front = shopFloorFootprint(0, 0).maxZ;
  if (Math.abs(x - SHOP.door.x) <= DOOR_HALF + 0.45 && z > front - 0.05 && z < PATH_START_Z + 0.05) {
    return true;
  }
  const trunk = TREE_TRUNK_RADIUS * (1 + TREE_SCALE_SPREAD) + 0.16;
  for (const tree of trees) {
    if (Math.hypot(x - tree.x, z - tree.z) < trunk) return true;
  }
  for (const rock of rocks) {
    if (Math.hypot(x - rock.x, z - rock.z) < gardenRockRadius(rock.scale ?? 1) + 0.22) return true;
  }
  return false;
}

/**
 * Deterministic blossoms on every lawn. Centres stay off the shop, path,
 * fountain, hatch, door, trunks, and rocks. Callers instance the flower mesh.
 */
export function gardenFlowerSpots(expansionIds = []) {
  const key = expansionIds.length ? [...expansionIds].sort().join('|') : '-';
  const cached = flowerSpotCache.get(key);
  if (cached) return cached;
  const grass = gardenBox(expansionIds);
  const rand = gardenSeedRand(510510 + key.length * 97);
  const trees = gardenTreeSpots(expansionIds);
  const rocks = gardenRockSpots(expansionIds);
  const spots = [];
  const cell = 2.05;
  const cols = Math.max(1, Math.ceil((grass.maxX - grass.minX) / cell));
  const rows = Math.max(1, Math.ceil((grass.maxZ - grass.minZ) / cell));
  const dx = (grass.maxX - grass.minX) / cols;
  const dz = (grass.maxZ - grass.minZ) / rows;
  const tooClose = (x, z, gap) => spots.some((spot) => Math.hypot(spot.x - x, spot.z - z) < gap);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (rand() < 0.38) continue;
      const extras = rand() < 0.28 ? 2 : 1;
      for (let k = 0; k < extras; k += 1) {
        const x = grass.minX + (c + 0.12 + rand() * 0.76) * dx;
        const z = grass.minZ + (r + 0.12 + rand() * 0.76) * dz;
        if (flowerBlocked(x, z, expansionIds, trees, rocks)) continue;
        if (tooClose(x, z, 0.62)) continue;
        spots.push({
          x,
          z,
          yaw: rand() * Math.PI * 2,
          scale: 0.58 + rand() * 0.62,
          tint: Math.floor(rand() * FLOWER_TINT_COUNT),
        });
      }
    }
  }
  flowerSpotCache.set(key, spots);
  return spots;
}

function gardenSeedRand(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Cluster centers for instanced lawn blades. Filtered like trees when a room is built. */
export function gardenGrassClusters(expansionIds = []) {
  const grass = gardenBox(expansionIds);
  const path = cobblePathSpan(expansionIds);
  const rand = gardenSeedRand(424242 + expansionIds.join(':').length * 31);
  const clusters = [];
  const cols = 22;
  const rows = 20;
  const dx = (grass.maxX - grass.minX) / cols;
  const dz = (grass.maxZ - grass.minZ) / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = grass.minX + (c + 0.18 + rand() * 0.64) * dx;
      const z = grass.minZ + (r + 0.18 + rand() * 0.64) * dz;
      if (!keepGardenSpot({ x, z, side: 'edge' }, expansionIds)) continue;
      if (pointHitsTrapdoor(x, z, TRAPDOOR_CLUSTER_CLEAR)) continue;
      clusters.push({
        x,
        z,
        blades: 10 + Math.floor(rand() * 8),
        scale: 0.68 + rand() * 1.05,
      });
    }
  }
  const edgeN = 32;
  for (let i = 0; i < edgeN; i += 1) {
    const t = i / Math.max(1, edgeN - 1);
    const z = path.minZ + t * (path.maxZ - path.minZ);
    for (const side of [-1, 1]) {
      const x = (side < 0 ? path.minX : path.maxX) + side * (0.58 + rand() * 0.62);
      const zz = z + (rand() - 0.5) * 0.32;
      if (!keepGardenSpot({ x, z: zz, side: 'path' }, expansionIds)) continue;
      if (pointHitsTrapdoor(x, zz, TRAPDOOR_CLUSTER_CLEAR)) continue;
      clusters.push({
        x,
        z: zz,
        blades: 12 + Math.floor(rand() * 9),
        scale: 0.82 + rand() * 1.15,
      });
    }
  }
  return clusters;
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

const SHELF_WALL_END_PAD = 0.72;
const SHELF_DOOR_HALF = 1.12;

function pushWallMount(mounts, {
  wall, axis, along0, minAlong, maxAlong, x, z, rot, doorAlong = null,
}) {
  const ranges = [];
  if (doorAlong == null) {
    ranges.push([minAlong, maxAlong]);
  } else {
    const leftMax = doorAlong - SHELF_DOOR_HALF;
    const rightMin = doorAlong + SHELF_DOOR_HALF;
    if (leftMax - minAlong > 0.9) ranges.push([minAlong, leftMax]);
    if (maxAlong - rightMin > 0.9) ranges.push([rightMin, maxAlong]);
  }
  for (const [lo, hi] of ranges) {
    mounts.push({
      wall,
      axis,
      along0,
      minAlong: lo,
      maxAlong: hi,
      x,
      z,
      rot,
    });
  }
}

/** Wall-grid mounts for shelves: exposed shop walls, skipping doorways. */
export function wallShelfMounts(expansionIds = []) {
  const mounts = [];
  for (const cell of occupiedCells(expansionIds)) {
    const interior = roomInteriorFloor(cell.gx, cell.gz);
    const neigh = neighborsOf(cell.gx, cell.gz, expansionIds);
    const midX = (interior.minX + interior.maxX) / 2;
    const midZ = (interior.minZ + interior.maxZ) / 2;
    const walls = [
      {
        wall: 'back',
        axis: 'x',
        along0: midX,
        minAlong: interior.minX + SHELF_WALL_END_PAD,
        maxAlong: interior.maxX - SHELF_WALL_END_PAD,
        z: interior.minZ + SHELF_FROM_WALL,
        rot: 0,
        doorAlong: neigh.back ? midX : null,
      },
      {
        wall: 'front',
        axis: 'x',
        along0: midX,
        minAlong: interior.minX + SHELF_WALL_END_PAD,
        maxAlong: interior.maxX - SHELF_WALL_END_PAD,
        z: interior.maxZ - SHELF_FROM_WALL,
        rot: Math.PI,
        doorAlong: neigh.front ? midX : null,
      },
      {
        wall: 'left',
        axis: 'z',
        along0: midZ,
        minAlong: interior.minZ + SHELF_WALL_END_PAD,
        maxAlong: interior.maxZ - SHELF_WALL_END_PAD,
        x: interior.minX + SHELF_FROM_WALL,
        rot: Math.PI / 2,
        doorAlong: neigh.left ? midZ : null,
      },
      {
        wall: 'right',
        axis: 'z',
        along0: midZ,
        minAlong: interior.minZ + SHELF_WALL_END_PAD,
        maxAlong: interior.maxZ - SHELF_WALL_END_PAD,
        x: interior.maxX - SHELF_FROM_WALL,
        rot: -Math.PI / 2,
        doorAlong: neigh.right ? midZ : null,
      },
    ];
    for (const spec of walls) pushWallMount(mounts, spec);
  }
  return mounts;
}

function wrapAngle(rad) {
  const tau = Math.PI * 2;
  let wrapped = rad % tau;
  if (wrapped > Math.PI) wrapped -= tau;
  if (wrapped < -Math.PI) wrapped += tau;
  return wrapped;
}

function angleDiff(a, b) {
  return Math.abs(wrapAngle((a ?? 0) - (b ?? 0)));
}

export function snapToWallGrid(x, z, expansionIds = [], preferRot = null) {
  const mounts = wallShelfMounts(expansionIds);
  let best = null;
  let bestScore = Infinity;
  for (const mount of mounts) {
    let nx;
    let nz;
    let perp;
    if (mount.axis === 'x') {
      nx = Math.round(x / FURNITURE_SNAP) * FURNITURE_SNAP;
      nx = Math.min(mount.maxAlong, Math.max(mount.minAlong, nx));
      nz = mount.z;
      perp = Math.abs(z - mount.z);
    } else {
      nz = Math.round(z / FURNITURE_SNAP) * FURNITURE_SNAP;
      nz = Math.min(mount.maxAlong, Math.max(mount.minAlong, nz));
      nx = mount.x;
      perp = Math.abs(x - mount.x);
    }
    const along = mount.axis === 'x' ? Math.abs(nx - x) : Math.abs(nz - z);
    const facing = preferRot == null ? 0 : angleDiff(preferRot, mount.rot) * 0.25;
    // Prefer the nearest wall plane so front/back don't inherit side yaw.
    const score = perp * 3 + along * 0.2 + facing;
    if (score < bestScore) {
      bestScore = score;
      best = { x: nx, z: nz, rot: mount.rot };
    }
  }
  return best ?? { x, z, rot: preferRot ?? FURNITURE_FORWARD };
}

export function pointOnFloors(x, z, floors, pad = 0) {
  return floors.some((rect) => (
    x >= rect.minX + pad
    && x <= rect.maxX - pad
    && z >= rect.minZ + pad
    && z <= rect.maxZ - pad
  ));
}

/** Inclusive snap coordinates that reach the wall faces of a floor span. */
export function snapGridSpan(min, max, snap = FURNITURE_SNAP) {
  const start = Math.floor(min / snap) * snap;
  const end = Math.ceil(max / snap) * snap;
  return { start, end };
}

/**
 * Overlay line positions for a floor rect. Extra snap cells past a wall are
 * clamped onto the interior face so front/back lines sit on the stone the
 * way the side-wall lines already do.
 */
export function snapGridLines(rect, snap = FURNITURE_SNAP) {
  const { start: minX, end: maxX } = snapGridSpan(rect.minX, rect.maxX, snap);
  const { start: minZ, end: maxZ } = snapGridSpan(rect.minZ, rect.maxZ, snap);
  const xs = [];
  const zs = [];
  for (let x = minX; x <= maxX + 1e-6; x += snap) {
    xs.push(Math.min(rect.maxX, Math.max(rect.minX, x)));
  }
  for (let z = minZ; z <= maxZ + 1e-6; z += snap) {
    zs.push(Math.min(rect.maxZ, Math.max(rect.minZ, z)));
  }
  return { xs, zs };
}

export function snapToFloor(x, z, floors, margin = FLOOR_SNAP_MARGIN) {
  const sx = Math.round(x / FURNITURE_SNAP) * FURNITURE_SNAP;
  const sz = Math.round(z / FURNITURE_SNAP) * FURNITURE_SNAP;
  if (pointOnFloors(sx, sz, floors, margin)) return { x: sx, z: sz };
  let best = null;
  let bestDist = Infinity;
  for (const rect of floors) {
    const loX = Math.ceil((rect.minX + margin) / FURNITURE_SNAP - 1e-9) * FURNITURE_SNAP;
    const hiX = Math.floor((rect.maxX - margin) / FURNITURE_SNAP + 1e-9) * FURNITURE_SNAP;
    const loZ = Math.ceil((rect.minZ + margin) / FURNITURE_SNAP - 1e-9) * FURNITURE_SNAP;
    const hiZ = Math.floor((rect.maxZ - margin) / FURNITURE_SNAP + 1e-9) * FURNITURE_SNAP;
    if (loX > hiX || loZ > hiZ) continue;
    const qx = Math.min(hiX, Math.max(loX, sx));
    const qz = Math.min(hiZ, Math.max(loZ, sz));
    if (!pointOnFloors(qx, qz, floors, margin)) continue;
    const dist = Math.hypot(qx - x, qz - z);
    if (dist < bestDist) {
      best = { x: qx, z: qz };
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
