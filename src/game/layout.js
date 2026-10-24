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
/** Starter armour stands face into the shop. +Z (0) looks out the door. */
export const STARTER_MANNEQUIN_YAW = Math.PI;

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
/** Saw logs into planks. Luke's model replaces the procedural bench later. */
export const SAWMILL_COST = 20000;
export const FURNACE_COST = 0;
export const RANGE_COST = 0;
/** One portal. Opens the outdoor rune field. */
export const PORTAL_COST = 500000;
/**
 * RuneLite dump of Object Portal, in OSRS units: X 642, Y 318, Z 249.
 * 0.01125 m/unit makes it about 3.6 m tall and 7.2 m wide. The placed mesh
 * keeps that shape and is fit to a player-height doorway.
 */
export const PORTAL_DUMP = Object.freeze({ x: 642, y: 318, z: 249 });
export const PORTAL_TARGET_HEIGHT = 2.2;
export const PORTAL_TARGET_WIDTH = PORTAL_TARGET_HEIGHT * (PORTAL_DUMP.x / PORTAL_DUMP.y);
export const PORTAL_TARGET_DEPTH = PORTAL_TARGET_HEIGHT * (PORTAL_DUMP.z / PORTAL_DUMP.y);
/** Default preview on the left lawn, off the path and the shop walls. */
export const PORTAL_HOME = Object.freeze({ x: -11.2, z: 4.2, rot: FURNITURE_FORWARD });
export const STATION_UNLOCKS = [
  { id: 'furnace', label: 'Furnace', cost: FURNACE_COST },
  { id: 'range', label: 'Cooking Range', cost: RANGE_COST },
  { id: 'loom', label: 'Loom', cost: LOOM_COST },
  { id: 'fletch', label: 'Fletching Bench', cost: FLETCH_COST },
  { id: 'potter', label: 'Potter Wheel', cost: POTTER_COST },
  { id: 'sawmill', label: 'Sawmill', cost: SAWMILL_COST },
  { id: 'wheel', label: 'Spinning Wheel', cost: WHEEL_COST },
  { id: 'cauldron', label: 'Cauldron', cost: CAULDRON_COST },
  { id: 'portal', label: 'Portal', cost: PORTAL_COST },
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
  { type: 'farming_patch', kind: 'patch', label: 'Farming Patch' },
];

/** Gold for the 1st through 6th farming patch. Further buys are refused. */
export const FARMING_PATCH_COSTS = Object.freeze([
  1000000, 2000000, 4000000, 8000000, 16000000, 32000000,
]);
export const FARMING_PATCH_CAP = 6;
/** Half of a 2×2 tile patch at the OSRS unit scale (2.88 / 2). */
export const FARMING_PATCH_HALF = 1.44;

/**
 * Nails and planks for one new build-menu placement.
 * Future furniture: add a key (the build-menu id) with `nails` and `planks`.
 * Buy and place read this table, so that row is the whole material cost.
 *
 * Tiers follow the gold price already on the piece, then how built it is when
 * the gold matches. Tables, shelves, and mannequins share the 500g curve, so
 * the table stays on plain planks and bronze, the shelf steps up to oak and
 * iron, and the mannequin steps up to willow and steel. The 50,000g stations
 * share mithril and maple. The wheel, portal, and cauldron keep climbing.
 *
 * Furnace, cooking range, and sawmill are absent on purpose. The furnace
 * smelts bars, the sawmill saws planks, and both starters are free to place.
 * Shop expansions are rooms and stay gold-only.
 *
 * A gold cost of 0 (included shelf, or a free replacement of a piece the
 * player already owned) does not spend the row. Loading a save never does.
 */
function buildMaterialRow(nailId, nails, plankId, planks) {
  return Object.freeze({
    nails: Object.freeze({ id: nailId, count: nails }),
    planks: Object.freeze({ id: plankId, count: planks }),
  });
}

export const FURNITURE_BUILD_COSTS = Object.freeze({
  table: buildMaterialRow('bronze_nails', 8, 'plank', 4),
  shelf: buildMaterialRow('iron_nails', 10, 'oak_plank', 3),
  mannequin: buildMaterialRow('steel_nails', 12, 'willow_plank', 2),
  loom: buildMaterialRow('mithril_nails', 15, 'maple_plank', 4),
  fletch: buildMaterialRow('mithril_nails', 15, 'maple_plank', 4),
  potter: buildMaterialRow('mithril_nails', 15, 'maple_plank', 4),
  wheel: buildMaterialRow('adamant_nails', 20, 'yew_plank', 4),
  portal: buildMaterialRow('runite_nails', 25, 'magic_plank', 6),
  cauldron: buildMaterialRow('dragon_nails', 30, 'magic_plank', 8),
});

/**
 * Nails and planks for the 1st through 6th farming patch.
 * Index is how many patches have already been paid for.
 */
export const FARMING_PATCH_MATERIALS = Object.freeze([
  buildMaterialRow('iron_nails', 6, 'oak_plank', 2),
  buildMaterialRow('steel_nails', 8, 'willow_plank', 3),
  buildMaterialRow('mithril_nails', 10, 'maple_plank', 4),
  buildMaterialRow('adamant_nails', 12, 'yew_plank', 5),
  buildMaterialRow('runite_nails', 15, 'magic_plank', 6),
  buildMaterialRow('dragon_nails', 20, 'magic_plank', 8),
]);

function partsFromRow(row) {
  if (!row) return [];
  const parts = [];
  if (row.nails?.id && row.nails.count > 0) {
    parts.push({ id: row.nails.id, count: row.nails.count, kind: 'nails' });
  }
  if (row.planks?.id && row.planks.count > 0) {
    parts.push({ id: row.planks.id, count: row.planks.count, kind: 'planks' });
  }
  return parts;
}

/**
 * Material parts for a build-menu id. Empty when that piece spends no stock.
 * `index` is the next farming-patch tier (bought count before this purchase).
 */
export function furnitureBuildParts(id, index = 0) {
  if (id === 'farming_patch') {
    const n = Math.max(0, Math.min(FARMING_PATCH_MATERIALS.length - 1, Math.floor(Number(index) || 0)));
    return partsFromRow(FARMING_PATCH_MATERIALS[n]);
  }
  return partsFromRow(FURNITURE_BUILD_COSTS[id]);
}

/** True when a lawn point sits inside a placed farming patch. */
export function spotOnFarmingPatch(x, z, furniture = null, pad = 0) {
  const patches = furniture?.patches ?? [];
  const hw = FARMING_PATCH_HALF + pad;
  const hd = FARMING_PATCH_HALF + pad;
  return patches.some((pose) => (
    pose
    && Number.isFinite(pose.x)
    && Number.isFinite(pose.z)
    && Math.abs(x - pose.x) <= hw
    && Math.abs(z - pose.z) <= hd
  ));
}

/** 'tree', 'rock', 'pond', or null when a patch rectangle meets a trunk, boulder, or the fishing pond. */
export function patchHitsTreeOrRock(pose, expansionIds = []) {
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return null;
  const hw = FARMING_PATCH_HALF;
  const hd = FARMING_PATCH_HALF;
  const hits = (x, z, r) => {
    const dx = Math.max(Math.abs(x - pose.x) - hw, 0);
    const dz = Math.max(Math.abs(z - pose.z) - hd, 0);
    return dx * dx + dz * dz < r * r;
  };
  const trunk = TREE_TRUNK_RADIUS * OUTDOOR_TREE_SCALE;
  for (const tree of gardenTreeSpots(expansionIds)) {
    if (hits(tree.x, tree.z, trunk)) return 'tree';
  }
  for (const rock of gardenRockSpots(expansionIds)) {
    if (hits(rock.x, rock.z, gardenRockRadius(rock.scale ?? 1))) return 'rock';
  }
  if (rectHitsPond(pose.x, pose.z, hw, hd)) return 'pond';
  return null;
}

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

/**
 * Outdoor wood trees. Canopy is the horizontal radius at the 0.01125 dump
 * scale, before the ±15% garden roll. Teak is not used.
 */
export const WOOD_TREE_SPECS = Object.freeze({
  oak: { id: 'oak', materialId: 'oak_logs', name: 'Oak', canopy: 2.15, lookId: 'tree-oak' },
  willow: { id: 'willow', materialId: 'willow_logs', name: 'Willow', canopy: 1.55, lookId: 'tree-willow' },
  maple: { id: 'maple', materialId: 'maple_logs', name: 'Maple', canopy: 1.45, lookId: 'tree-maple' },
  yew: { id: 'yew', materialId: 'yew_logs', name: 'Yew', canopy: 2.05, lookId: 'tree-yew' },
  magic: { id: 'magic', materialId: 'magic_logs', name: 'Magic', canopy: 1.65, lookId: 'tree-magic' },
});

/** Grass-click radius. Wider crowns reach past the pine click box. */
export function treeClickRadius(spot) {
  const canopy = Number(spot?.canopy);
  if (Number.isFinite(canopy) && canopy > 0) return Math.max(TREE_CLICK_RADIUS, canopy + 0.4);
  return TREE_CLICK_RADIUS;
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

/**
 * Fishing pond on the front-right lawn. +X is screen-right from the default
 * camera (it sits on +Z looking toward −Z), so this is the shop's right side.
 *
 * It never touches an expansion pad: the Right room's front wall is z = 3.65
 * and the Behind Right room is further back, so the pond (z 6.5 to 10.7) keeps
 * a 2.85 m lawn strip in front of a built Right room. No pad has gz = +1, so
 * nothing will ever be built on this patch of lawn. Ellipse in world metres.
 */
export const POND = Object.freeze({ x: 8.9, z: 8.6, rx: 2.7, rz: 2.1 });
/** Decor (trees, rocks, flax, flowers, grass tufts) stays this far off the water. */
export const POND_DECOR_CLEAR = 0.6;
/**
 * Plank dock on the west shore, toward the path. Walkable: feet ride up onto
 * the deck over `ramp` metres at the shore end. Rect in world metres.
 */
export const POND_DOCK = Object.freeze({
  minX: 5.75, maxX: 7.55, minZ: 8.12, maxZ: 9.08, top: 0.1, ramp: 0.4,
});

function fishingSpot(id, materialId, name, water, stand) {
  return Object.freeze({
    id,
    materialId,
    name,
    x: water.x,
    z: water.z,
    stand: Object.freeze({ ...stand }),
    face: Math.atan2(water.x - stand.x, water.z - stand.z),
  });
}

/**
 * One fishing spot per fish, like one rock per ore. `x/z` is the bubbling
 * water the line drops into; `stand` is where the feet go (shore or dock end)
 * and `face` the yaw toward the water. Levels live in skills.js.
 */
export const FISHING_SPOTS = Object.freeze([
  fishingSpot('shrimp', 'raw_shrimp', 'Shrimp fishing spot', { x: 7.9, z: 7.85 }, { x: 6.55, z: 8.4 }),
  fishingSpot('salmon', 'raw_salmon', 'Salmon fishing spot', { x: 8.05, z: 8.6 }, { x: 7.25, z: 8.6 }),
  fishingSpot('lobster', 'raw_lobster', 'Lobster fishing spot', { x: 9.7, z: 7.25 }, { x: 9.7, z: 6.02 }),
  fishingSpot('monkfish', 'raw_monkfish', 'Monkfish fishing spot', { x: 10.85, z: 8.2 }, { x: 12.05, z: 8.2 }),
  fishingSpot('shark', 'raw_shark', 'Shark fishing spot', { x: 9.95, z: 9.85 }, { x: 9.95, z: 11.08 }),
  fishingSpot('anglerfish', 'raw_anglerfish', 'Anglerfish fishing spot', { x: 7.45, z: 9.75 }, { x: 7.45, z: 10.95 }),
]);

/** Floor-click reach around a spot's water marker. */
export const FISHING_CLICK_RADIUS = 0.75;

export function fishingSpotById(id) {
  return FISHING_SPOTS.find((spot) => spot.id === id || spot.materialId === id) ?? null;
}

/** True inside the pond ellipse grown by `pad` metres. */
export function pointInPond(x, z, pad = 0) {
  const rx = POND.rx + pad;
  const rz = POND.rz + pad;
  if (rx <= 0 || rz <= 0) return false;
  const dx = (x - POND.x) / rx;
  const dz = (z - POND.z) / rz;
  return dx * dx + dz * dz <= 1;
}

export function pointOnDock(x, z, pad = 0) {
  return x >= POND_DOCK.minX - pad && x <= POND_DOCK.maxX + pad
    && z >= POND_DOCK.minZ - pad && z <= POND_DOCK.maxZ + pad;
}

/** Water, dock, or a fishing stand within `pad` (stands get a body-sized extra). */
export function pondBlocksSpot(x, z, pad = POND_DECOR_CLEAR) {
  if (pointInPond(x, z, pad)) return true;
  if (pointOnDock(x, z, pad)) return true;
  return FISHING_SPOTS.some((spot) => Math.hypot(x - spot.stand.x, z - spot.stand.z) < pad + 0.55);
}

/** True when an axis-aligned rect (centre, half sizes) meets the pond, dock, or a fishing stand. */
export function rectHitsPond(cx, cz, hw, hd, pad = 0.1) {
  const steps = 6;
  for (let i = 0; i <= steps; i += 1) {
    for (let j = 0; j <= steps; j += 1) {
      const x = cx - hw + (2 * hw * i) / steps;
      const z = cz - hd + (2 * hd * j) / steps;
      if (pondBlocksSpot(x, z, pad)) return true;
    }
  }
  return false;
}

/**
 * Walk blocks for the water: horizontal strips under the ellipse, inset a
 * little so the rim stones stay walkable, with the dock lane cut out.
 */
export function pondWaterBlocks(inset = 0.18, band = 0.3) {
  const blocks = [];
  const rx = POND.rx - inset;
  const rz = POND.rz - inset;
  for (let z0 = POND.z - rz; z0 < POND.z + rz - 1e-6; z0 += band) {
    const z1 = Math.min(POND.z + rz, z0 + band);
    const mid = Math.min(Math.abs(z0 - POND.z), Math.abs(z1 - POND.z));
    const near = (z0 <= POND.z && z1 >= POND.z) ? 0 : mid;
    const t = near / rz;
    const half = rx * Math.sqrt(Math.max(0, 1 - t * t));
    if (half < 0.05) continue;
    const minX = POND.x - half;
    const maxX = POND.x + half;
    const crossesDock = z1 > POND_DOCK.minZ && z0 < POND_DOCK.maxZ;
    if (crossesDock && minX < POND_DOCK.maxX) {
      // Water south and north of the dock lane, then the open water past its end.
      if (z0 < POND_DOCK.minZ) blocks.push({ minX, maxX, minZ: z0, maxZ: POND_DOCK.minZ });
      if (z1 > POND_DOCK.maxZ) blocks.push({ minX, maxX, minZ: POND_DOCK.maxZ, maxZ: z1 });
      const laneMinZ = Math.max(z0, POND_DOCK.minZ);
      const laneMaxZ = Math.min(z1, POND_DOCK.maxZ);
      if (maxX > POND_DOCK.maxX) blocks.push({ minX: POND_DOCK.maxX, maxX, minZ: laneMinZ, maxZ: laneMaxZ });
      continue;
    }
    blocks.push({ minX, maxX, minZ: z0, maxZ: z1 });
  }
  return blocks.filter((rect) => rect.maxZ - rect.minZ > 0.02 && rect.maxX - rect.minX > 0.02);
}

/** Deck height under (x, z), easing up from the lawn over the ramp. Null off the dock. */
export function dockGroundY(x, z) {
  if (!pointOnDock(x, z)) return null;
  const fromShore = x - POND_DOCK.minX;
  if (fromShore >= POND_DOCK.ramp) return POND_DOCK.top;
  const t = Math.max(0, fromShore / POND_DOCK.ramp);
  return POND_DOCK.top * t * t * (3 - 2 * t);
}
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
 * Shop floor mesh. One solid slab fills each room. Its top is the old plank
 * top, above y=0, so feet and furniture stay at the same height.
 */
export const SHOP_FLOOR_SLAB = { thickness: 0.08, centerY: 0.04 };
export const SHOP_FLOOR_PLANK = {
  thickness: 0.025,
  centerY: 0.085,
};
/** Lawn and path height. Feet already rest here outdoors. */
export const OUTDOOR_GROUND_Y = 0;
/** Distance in front of the floor where the doorway eases up onto the floor. */
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

/** World XZ of one room's solid floor slab. Neighbouring rooms meet on these edges. */
export function shopFloorFootprint(gx = 0, gz = 0) {
  const c = roomCenter(gx, gz);
  return {
    minX: c.x - ROOM_W / 2,
    maxX: c.x + ROOM_W / 2,
    minZ: c.z - ROOM_D / 2,
    maxZ: c.z + ROOM_D / 2,
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
  const dock = dockGroundY(x, z);
  if (dock != null) return outdoorY + dock;
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
  // The extra 0.28 matches the player radius so a click on the visible grass
  // edge, including the far back of a fully expanded shop, is a legal stand.
  const edge = 0.28;
  const lawn = {
    minX: grass.minX - edge,
    maxX: grass.maxX + edge,
    minZ: grass.minZ - edge,
    maxZ: grass.maxZ + edge,
  };
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

/** Potter wheel is drawn and placed at 2× its old placeholder size (Luke 2026-10-24). */
export const POTTER_SIZE = 2;

export function furnitureHalfSize(kind) {
  if (kind === 'cauldron') return { hw: 0.32, hd: 0.32 };
  if (kind === 'furnace') return { hw: 0.4, hd: 0.36 };
  if (kind === 'wheel') return { hw: 0.72, hd: 0.64 };
  if (kind === 'anvil') return { hw: 0.22, hd: 0.175 };
  if (kind === 'chest') return { hw: 0.3, hd: 0.22 };
  if (kind === 'range') return { hw: 0.68, hd: 0.56 };
  if (kind === 'loom') return { hw: 0.48, hd: 0.36 };
  if (kind === 'fletch') return { hw: 0.55, hd: 0.4 };
  if (kind === 'potter') return { hw: 0.4 * POTTER_SIZE, hd: 0.4 * POTTER_SIZE };
  if (kind === 'sawmill') return { hw: 0.72, hd: 0.36 };
  if (kind === 'patch' || kind === 'farming_patch') return { hw: FARMING_PATCH_HALF, hd: FARMING_PATCH_HALF };
  if (kind === 'portal') return { hw: PORTAL_TARGET_WIDTH / 2, hd: PORTAL_TARGET_DEPTH / 2 };
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
    sawmill: null,
    portal: null,
    rug: { x: shopRugPose().x, z: shopRugPose().z, rot: FURNITURE_FORWARD },
    patches: [],
    placed: [],
    displays: SHOP.displays.map((spot) => (
      (spot.kind ?? 'table') === 'shelf'
        ? snapToWallGrid(spot.x, spot.z, [])
        : {
          x: spot.x,
          z: spot.z,
          rot: spot.kind === 'stand' ? STARTER_MANNEQUIN_YAW : FURNITURE_FORWARD,
        }
    )),
  };
}

function clonePose(pose) {
  return pose ? { ...pose } : null;
}

function yawNear(a, b, eps = 0.02) {
  let delta = ((a ?? 0) - (b ?? 0)) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta) <= eps;
}

/**
 * Starter mannequins that were never moved or turned face into the shop.
 * A different spot or rotation is the player's, including later placements.
 */
export function migrateStarterMannequins(poses, displays = SHOP.displays) {
  return (poses ?? []).map((pose, index) => {
    const spot = displays[index];
    if (!pose || !spot || spot.kind !== 'stand' || spot.bought) return pose;
    const unmoved = Math.abs(pose.x - spot.x) <= 0.02 && Math.abs(pose.z - spot.z) <= 0.02;
    if (!unmoved || !yawNear(pose.rot, FURNITURE_FORWARD)) return pose;
    return { ...pose, rot: STARTER_MANNEQUIN_YAW };
  });
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
    sawmill: clonePose(furniture.sawmill),
    portal: clonePose(furniture.portal),
    rug: { ...(furniture.rug ?? defaults.rug) },
    displays: (furniture.displays ?? defaults.displays).map((pose) => ({ ...pose })),
    patches: (furniture.patches ?? []).map((pose) => ({ ...pose })),
    placed: (furniture.placed ?? []).map((pose) => ({ ...pose })),
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

/** Indoor floor rects plus the lawn, so a portal can sit on the grass. */
export function portalPlaceFloors(expansionIds = []) {
  const grass = gardenBox(expansionIds);
  return [
    ...placeFloors(expansionIds),
    { minX: grass.minX, maxX: grass.maxX, minZ: grass.minZ, maxZ: grass.maxZ },
  ];
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

/**
 * Far end of the cobble, at the grass edge. Buyers appear here and walk
 * back out to the same spot. Inset so a standing body is on the stones
 * and inside the lawn.
 */
export function cobblePathGate(expansionIds = [], radius = 0.28) {
  const span = cobblePathSpan(expansionIds);
  const grass = gardenBox(expansionIds);
  const x = (span.minX + span.maxX) / 2;
  const z = Math.min(span.maxZ - 0.02, grass.maxZ - Math.max(0, radius) - 0.01);
  return { x, z };
}

/**
 * Walk from the path gate up the cobble to the shop side of the fountain.
 * The basin fills the straight path, so the route bows onto the apron.
 */
export function buyerCobbleRoute(expansionIds = [], radius = 0.28) {
  const spawn = cobblePathGate(expansionIds, radius);
  const toDoor = [];
  const apron = FOUNTAIN.apron ?? 1.42;
  if (!keepFountain(expansionIds) || !(FOUNTAIN.z < spawn.z - apron)) return { spawn, toDoor };
  const passR = Math.min(apron - 0.18, FOUNTAIN.radius + 0.52);
  const bow = (turn) => ({
    x: FOUNTAIN.x + Math.sin(turn) * passR,
    z: FOUNTAIN.z + Math.cos(turn) * passR,
  });
  const ahead = { x: spawn.x, z: FOUNTAIN.z + apron + 0.2 };
  const back = { x: spawn.x, z: FOUNTAIN.z - apron - 0.2 };
  if (ahead.z < spawn.z - 0.35) toDoor.push(ahead);
  toDoor.push(bow(Math.PI * 0.21), bow(Math.PI / 2), bow(Math.PI * 0.79));
  if (back.z > PATH_START_Z + 0.4) toDoor.push(back);
  return { spawn, toDoor };
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
  if (pondBlocksSpot(spot.x, spot.z)) return false;
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

function treeSitRadius(spotOrSide) {
  const spot = typeof spotOrSide === 'string' ? { side: spotOrSide } : (spotOrSide ?? {});
  const canopy = Number(spot.canopy);
  if (Number.isFinite(canopy) && canopy > 0) return canopy * (1 + TREE_SCALE_SPREAD);
  return treeCanopyRadius(spot.side);
}

/** Grass-click reach. A walk click outside this radius must not start a chop. */
function treeChopClear(spot) {
  const canopy = Number(spot?.canopy);
  if (Number.isFinite(canopy) && canopy > 0) return canopy + 0.4;
  return TREE_CLICK_RADIUS;
}

function pushOutOfAabb(x, z, rect) {
  if (x < rect.minX || x > rect.maxX || z < rect.minZ || z > rect.maxZ) {
    return { x, z, hit: false };
  }
  const left = x - rect.minX;
  const right = rect.maxX - x;
  const back = z - rect.minZ;
  const front = rect.maxZ - z;
  const min = Math.min(left, right, back, front);
  if (min === left) return { x: rect.minX - 0.08, z, hit: true };
  if (min === right) return { x: rect.maxX + 0.08, z, hit: true };
  if (min === back) return { x, z: rect.minZ - 0.08, hit: true };
  return { x, z: rect.maxZ + 0.08, hit: true };
}

/** Push a pine off the shop, the path, boulders, and neighbouring crowns. */
function settleGardenTree(spot, others, rocks, grass, expansionIds = []) {
  const crown = treeSitRadius(spot);
  const chop = treeChopClear(spot);
  const edgeInset = chop + 1.05;
  const shopPad = chop + 1.15;
  let x = spot.x;
  let z = spot.z;
  const clamp = () => {
    x = Math.min(grass.maxX - edgeInset, Math.max(grass.minX + edgeInset, x));
    z = Math.min(grass.maxZ - edgeInset, Math.max(grass.minZ + edgeInset, z));
  };
  const shove = () => {
    for (const rect of occupiedCells(expansionIds).map((cell) => {
      const c = roomCenter(cell.gx, cell.gz);
      return {
        minX: c.x - ROOM_W / 2 - shopPad,
        maxX: c.x + ROOM_W / 2 + shopPad,
        minZ: c.z - ROOM_D / 2 - shopPad,
        maxZ: c.z + ROOM_D / 2 + shopPad,
      };
    })) {
      const next = pushOutOfAabb(x, z, rect);
      x = next.x;
      z = next.z;
    }
    const path = cobblePathSpan(expansionIds);
    const pathRect = {
      minX: path.minX - crown,
      maxX: path.maxX + crown,
      minZ: path.minZ - crown,
      maxZ: path.maxZ + crown,
    };
    const offPath = pushOutOfAabb(x, z, pathRect);
    x = offPath.x;
    z = offPath.z;
    const apron = (FOUNTAIN.apron ?? 1.42) + crown;
    const dx = x - FOUNTAIN.x;
    const dz = z - FOUNTAIN.z;
    const dist = Math.hypot(dx, dz);
    if (dist < apron) {
      const len = dist || 1;
      x = FOUNTAIN.x + (dx / len) * (apron + 0.08);
      z = FOUNTAIN.z + (dz / len) * (apron + 0.08);
    }
  };
  clamp();
  shove();
  clamp();
  for (let pass = 0; pass < 12; pass += 1) {
    let moved = false;
    for (const rock of rocks) {
      const need = gardenRockRadius(rock.scale ?? 1) + crown;
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
    for (const other of others) {
      const need = crown + treeSitRadius(other) + 0.35;
      let dx = x - other.x;
      let dz = z - other.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= need) continue;
      if (dist < 1e-4) {
        dx = 1;
        dz = 0;
      }
      const push = (need - Math.max(dist, 1e-4)) * 0.65 + 0.02;
      const len = Math.hypot(dx, dz) || 1;
      x += (dx / len) * push;
      z += (dz / len) * push;
      moved = true;
    }
    shove();
    clamp();
    if (!moved) break;
  }
  return { ...spot, x, z };
}

export function gardenTreeTypeId(spot) {
  const wood = spot?.wood;
  if (wood && wood !== 'logs' && WOOD_TREE_SPECS[wood]) return wood;
  return 'pine';
}

const GARDEN_TYPE_ORDER = ['pine', 'oak', 'willow', 'maple', 'yew', 'magic'];

function patchBlocksTree(x, z, radius, furniture) {
  if (!furniture) return false;
  const poses = [];
  if (furniture.portal) poses.push({ kind: 'portal', pose: furniture.portal });
  for (const pose of furniture.patches ?? []) poses.push({ kind: 'patch', pose });
  return poses.some((item) => {
    const rect = poseRect(item.kind, item.pose);
    return x >= rect.minX - radius && x <= rect.maxX + radius
      && z >= rect.minZ - radius && z <= rect.maxZ + radius;
  });
}

function treeSpotFree(x, z, spot, kept, expansionIds, rocks, grass, furniture) {
  const crown = treeSitRadius(spot);
  const chop = treeChopClear(spot);
  if (x < grass.minX + chop + 0.8 || x > grass.maxX - chop - 0.8) return false;
  if (z < grass.minZ + chop + 0.8 || z > grass.maxZ - chop - 0.8) return false;
  if (pointHitsShop(x, z, expansionIds, chop + 1.15)) return false;
  if (pointOnPath(x, z, expansionIds, crown)) return false;
  if (!gardenSpotClearOfBeds({ x, z }, expansionIds, crown + 0.4)) return false;
  if (patchBlocksTree(x, z, crown, furniture)) return false;
  if (pondBlocksSpot(x, z, crown * 0.8)) return false;
  for (const rock of rocks) {
    if (Math.hypot(x - rock.x, z - rock.z) < gardenRockRadius(rock.scale ?? 1) + crown) return false;
  }
  for (const other of kept) {
    if (Math.hypot(x - other.x, z - other.z) < crown + treeSitRadius(other) + 0.35) return false;
  }
  return true;
}

function fallbackTreeSpot(wood, kept, expansionIds, grass, rocks, furniture) {
  const spec = wood === 'pine' ? null : WOOD_TREE_SPECS[wood];
  const spot = spec
    ? {
      x: 0,
      z: 0,
      side: 'edge',
      wood: spec.id,
      materialId: spec.materialId,
      name: `${spec.name} tree`,
      canopy: spec.canopy,
    }
    : { x: 0, z: 0, side: 'edge', materialId: 'logs', name: 'Tree' };
  const step = 1.7;
  for (let z = grass.minZ + 4; z <= grass.maxZ - 4; z += step) {
    for (let x = grass.minX + 4; x <= grass.maxX - 4; x += step) {
      if (!treeSpotFree(x, z, spot, kept, expansionIds, rocks, grass, furniture)) continue;
      return { ...spot, x, z };
    }
  }
  return null;
}

/** After layout or an expansion, every wood still has a living spot. Felled trees count. */
function ensureGardenTreeTypes(kept, expansionIds, grass, rocks, furniture) {
  for (const wood of GARDEN_TYPE_ORDER) {
    if (kept.some((spot) => gardenTreeTypeId(spot) === wood)) continue;
    const spot = fallbackTreeSpot(wood, kept, expansionIds, grass, rocks, furniture);
    if (spot) kept.push(spot);
  }
}

export function gardenTreeSpots(expansionIds = [], opts = {}) {
  const box = footprintBox(expansionIds);
  const grass = gardenBox(expansionIds);
  const cx = (box.minX + box.maxX) / 2;
  const cz = (box.minZ + box.maxZ) / 2;
  const woodSpot = (x, z, side, wood) => {
    const spec = WOOD_TREE_SPECS[wood];
    return {
      x,
      z,
      side,
      wood,
      materialId: spec.materialId,
      name: `${spec.name} tree`,
      canopy: spec.canopy,
    };
  };
  const spots = [
    { x: box.minX - 2.45, z: box.minZ + 1.5, side: 'left' },
    { x: box.maxX + 2.45, z: box.minZ + 1.35, side: 'right' },
    { x: cx, z: box.minZ - 3.15, side: 'rear' },
    { x: box.minX - 3.4, z: box.maxZ + 1.55, side: 'front-left' },
    { x: box.maxX + 3.4, z: box.maxZ + 1.7, side: 'front-right' },
    { x: -6.5, z: 8.7, side: 'path' },
    { x: grass.minX + 2.25, z: grass.minZ + 2.4, side: 'edge' },
    { x: grass.maxX - 2.25, z: cz + 3.3, side: 'edge' },
    woodSpot(cx - 7.2, box.minZ - 5.6, 'rear', 'oak'),
    woodSpot(box.maxX + 6.4, cz - 2.8, 'right', 'oak'),
    woodSpot(cx + 7.0, box.minZ - 5.4, 'rear', 'willow'),
    woodSpot(box.minX - 6.2, cz + 1.2, 'left', 'willow'),
    woodSpot(cx - 3.8, box.minZ - 6.6, 'rear', 'maple'),
    woodSpot(box.maxX + 5.8, cz + 2.6, 'right', 'maple'),
    woodSpot(cx + 3.4, box.minZ - 6.4, 'rear', 'yew'),
    woodSpot(box.minX - 6.6, cz - 2.4, 'left', 'yew'),
    woodSpot(grass.minX + 3.6, grass.maxZ - 3.4, 'edge', 'magic'),
    woodSpot(grass.maxX - 3.6, grass.minZ + 4.0, 'edge', 'magic'),
  ];
  const rocks = gardenRockSpots(expansionIds);
  const kept = [];
  for (const spot of spots) {
    const settled = settleGardenTree(spot, kept, rocks, grass, expansionIds);
    if (!keepGardenSpot(settled, expansionIds)) continue;
    if (pondBlocksSpot(settled.x, settled.z, treeSitRadius(settled) * 0.8)) continue;
    if (!gardenSpotClearOfBeds(settled, expansionIds)) continue;
    const stillInRock = rocks.some((rock) => (
      Math.hypot(settled.x - rock.x, settled.z - rock.z) < gardenRockRadius(rock.scale ?? 1) + 0.45
    ));
    if (stillInRock) continue;
    kept.push(settled);
  }
  ensureGardenTreeTypes(kept, expansionIds, grass, rocks, opts.furniture ?? null);
  return kept;
}

/** Outdoor grass only. A farming patch does not sit on the shop floor. */
export function patchPlaceFloors(expansionIds = []) {
  const grass = gardenBox(expansionIds);
  return [{ minX: grass.minX, maxX: grass.maxX, minZ: grass.minZ, maxZ: grass.maxZ }];
}

/**
 * A paid patch we can still draw. Off-map, NaN, and shop-interior poses are
 * not kept — those go back to a free re-place instead of an invisible buy.
 */
export function farmingPatchPoseKept(pose, expansionIds = []) {
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return false;
  if (Math.abs(pose.x) > 80 || Math.abs(pose.z) > 80) return false;
  const lawn = patchPlaceFloors(expansionIds)[0];
  if (!lawn) return false;
  const { hw, hd } = furnitureHalfSize('patch');
  if (pose.x - hw < lawn.minX - 0.05 || pose.x + hw > lawn.maxX + 0.05) return false;
  if (pose.z - hd < lawn.minZ - 0.05 || pose.z + hd > lawn.maxZ + 0.05) return false;
  if (pointHitsShop(pose.x, pose.z, expansionIds, 0.15)) return false;
  // A patch saved on the lawn before the pond existed goes back to a free re-place.
  if (rectHitsPond(pose.x, pose.z, hw, hd, 0)) return false;
  return true;
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
    // Moved off the pond (was 8.55, 8.35 at 2.8x) to its front-right corner.
    { x: 11.9, z: 11.45, scale: 2.4, side: 'right' },
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

/**
 * Open lawn reached through a placed portal. North is −Z (top of the minimap).
 * The return portal sits in the centre. Altars take the four edge midpoints:
 * Air north, Earth east, Water south, Fire west. Trees and rocks stay in the
 * corners and along the edges between those pads.
 */
export const RUNE_FIELD_HALF = 16;
export const RUNE_ALTAR_INSET = 4.2;
export const RUNE_PORTAL_CLEAR = 3.5;
export const RUNE_ALTAR_CLEAR = 2.8;

export function runeFieldRect() {
  return {
    minX: -RUNE_FIELD_HALF,
    maxX: RUNE_FIELD_HALF,
    minZ: -RUNE_FIELD_HALF,
    maxZ: RUNE_FIELD_HALF,
  };
}

export const RUNE_FIELD_PORTAL = Object.freeze({ x: 0, z: 0, rot: FURNITURE_FORWARD });

/** One step south of the centre portal, on the grass in front of the arch. */
export const RUNE_FIELD_ARRIVE = Object.freeze({
  x: 0,
  z: PORTAL_TARGET_DEPTH / 2 + 1.25,
});

export const RUNE_ALTAR_SPOTS = Object.freeze([
  { id: 'air', element: 'air', edge: 'north', x: 0, z: -(RUNE_FIELD_HALF - RUNE_ALTAR_INSET) },
  { id: 'earth', element: 'earth', edge: 'east', x: RUNE_FIELD_HALF - RUNE_ALTAR_INSET, z: 0 },
  { id: 'water', element: 'water', edge: 'south', x: 0, z: RUNE_FIELD_HALF - RUNE_ALTAR_INSET },
  { id: 'fire', element: 'fire', edge: 'west', x: -(RUNE_FIELD_HALF - RUNE_ALTAR_INSET), z: 0 },
]);

export function runeAltarSpot(id) {
  return RUNE_ALTAR_SPOTS.find((spot) => spot.id === id) ?? null;
}

/**
 * RuneLite altar dumps are about 373 × 154 × 363 OSRS units (X/Z swap by element).
 * Half of the usual 0.01125 m/unit scale: about 0.87 m tall and 2.1 m across,
 * still upright on the same pads.
 */
export const ALTAR_OSRS_SCALE = 0.005625;
export const ALTAR_HEIGHT = 154 * ALTAR_OSRS_SCALE;
export const ALTAR_SPAN_X = 373 * ALTAR_OSRS_SCALE;
export const ALTAR_SPAN_Z = 363 * ALTAR_OSRS_SCALE;
/** Square footprint that covers every altar, since X and Z swap between elements. */
export const ALTAR_FOOT = Math.max(ALTAR_SPAN_X, ALTAR_SPAN_Z);
export const ALTAR_CLICK = ALTAR_FOOT / 2 + 0.35;
/** Arch footprint plus a little, so grass does not cover the return portal. */
export const RUNE_PORTAL_GRASS_CLEAR = Math.hypot(PORTAL_TARGET_WIDTH, PORTAL_TARGET_DEPTH) / 2 + 0.2;

/** Decor must stay off the centre portal, the four altar pads, and the open middle. */
export function runeFieldClearOf(spot) {
  if (!spot) return false;
  if (Math.hypot(spot.x, spot.z) < RUNE_PORTAL_CLEAR) return false;
  for (const altar of RUNE_ALTAR_SPOTS) {
    if (Math.hypot(spot.x - altar.x, spot.z - altar.z) < RUNE_ALTAR_CLEAR) return false;
  }
  const pad = 1.15;
  if (Math.abs(spot.x) > RUNE_FIELD_HALF - pad) return false;
  if (Math.abs(spot.z) > RUNE_FIELD_HALF - pad) return false;
  if (Math.max(Math.abs(spot.x), Math.abs(spot.z)) < RUNE_FIELD_HALF - 6.5) return false;
  return true;
}

const RUNE_FIELD_TREES = [
  { x: -13.4, z: -13.4, band: 'corner' },
  { x: -11.2, z: -14.3, band: 'corner' },
  { x: 13.4, z: -13.4, band: 'corner' },
  { x: 11.2, z: -14.3, band: 'corner' },
  { x: 13.4, z: 13.4, band: 'corner' },
  { x: 11.2, z: 14.3, band: 'corner' },
  { x: -13.4, z: 13.4, band: 'corner' },
  { x: -11.2, z: 14.3, band: 'corner' },
  { x: -6.8, z: -14.3, band: 'edge' },
  { x: 7.0, z: -14.2, band: 'edge' },
  { x: 14.3, z: -6.7, band: 'edge' },
  { x: 14.2, z: 6.8, band: 'edge' },
  { x: -6.6, z: 14.3, band: 'edge' },
  { x: 6.9, z: 14.2, band: 'edge' },
  { x: -14.3, z: -6.5, band: 'edge' },
  { x: -14.2, z: 6.9, band: 'edge' },
];

const RUNE_FIELD_ROCKS = [
  { x: -14.6, z: -9.4, scale: 1.1, band: 'corner' },
  { x: -9.2, z: -14.6, scale: 0.85, band: 'corner' },
  { x: 14.6, z: -9.2, scale: 1.0, band: 'corner' },
  { x: 9.4, z: -14.6, scale: 0.8, band: 'corner' },
  { x: 14.6, z: 9.3, scale: 1.15, band: 'corner' },
  { x: 9.2, z: 14.6, scale: 0.75, band: 'corner' },
  { x: -14.6, z: 9.4, scale: 1.05, band: 'corner' },
  { x: -9.3, z: 14.6, scale: 0.9, band: 'corner' },
  { x: -4.2, z: -14.8, scale: 0.7, band: 'edge' },
  { x: 4.4, z: -14.7, scale: 0.85, band: 'edge' },
  { x: 14.8, z: -4.1, scale: 0.75, band: 'edge' },
  { x: 14.7, z: 4.2, scale: 0.9, band: 'edge' },
  { x: -4.0, z: 14.8, scale: 0.8, band: 'edge' },
  { x: 4.3, z: 14.7, scale: 0.7, band: 'edge' },
  { x: -14.8, z: -4.0, scale: 0.8, band: 'edge' },
  { x: -14.7, z: 4.3, scale: 0.7, band: 'edge' },
];

export function runeFieldTreeSpots() {
  return RUNE_FIELD_TREES.filter(runeFieldClearOf);
}

export function runeFieldRockSpots() {
  return RUNE_FIELD_ROCKS.filter(runeFieldClearOf);
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
const FLAX_STATION_IDS = ['counter', 'anvil', 'chest', 'range', 'furnace', 'cauldron', 'wheel', 'loom', 'fletch', 'potter', 'sawmill', 'portal'];

export function flaxSpotBlocked(x, z, expansionIds = [], { occupied = [], furniture = null, spacing = FLAX_SPACING } = {}) {
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
    const clear = id === 'portal'
      ? Math.hypot(furnitureHalfSize('portal').hw, furnitureHalfSize('portal').hd) + 0.4
      : FLAX_STATION_CLEAR;
    if (Math.hypot(x - pose.x, z - pose.z) < clear) return true;
  }
  for (const pose of furn.displays ?? []) {
    if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) continue;
    if (Math.hypot(x - pose.x, z - pose.z) < FLAX_DISPLAY_CLEAR) return true;
  }
  if (keepFountain(expansionIds)) {
    const clear = FOUNTAIN.apron + 0.2;
    if (Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < clear) return true;
  }
  for (const other of occupied) {
    const gap = Math.max(spacing, other.spacing ?? 0);
    if (Math.hypot(x - other.x, z - other.z) < gap) return true;
  }
  if (spotOnFarmingPatch(x, z, furniture, 0.05)) return true;
  return false;
}

/** Random grass spots that stay off the shop, path, stations, and each other. */
export function rollFlaxSpots(expansionIds = [], opts = {}) {
  const count = Math.max(0, opts.count ?? FLAX_COUNT);
  const rng = opts.rng ?? Math.random;
  const furniture = opts.furniture ?? null;
  const occupied = opts.occupied ?? [];
  const spacing = opts.spacing ?? FLAX_SPACING;
  const grass = gardenBox(expansionIds);
  const spanX = Math.max(0.1, grass.maxX - grass.minX - FLAX_EDGE * 2);
  const spanZ = Math.max(0.1, grass.maxZ - grass.minZ - FLAX_EDGE * 2);
  const spots = [];
  const maxTries = Math.max(800, count * 200);
  for (let i = 0; i < maxTries && spots.length < count; i += 1) {
    const x = grass.minX + FLAX_EDGE + rng() * spanX;
    const z = grass.minZ + FLAX_EDGE + rng() * spanZ;
    if (flaxSpotBlocked(x, z, expansionIds, { occupied: [...occupied, ...spots], furniture, spacing })) continue;
    spots.push({ x, z });
  }
  return spots;
}

/** Outdoor wheat clumps. Same pick/respawn rules as flax, wider so the stalks do not overlap. */
export const WHEAT_COUNT = 8;
export const WHEAT_SPACING = 1.85;
export const WHEAT_CLICK_RADIUS = 0.8;

export function rollWheatSpots(expansionIds = [], opts = {}) {
  return rollFlaxSpots(expansionIds, {
    ...opts,
    count: opts.count ?? WHEAT_COUNT,
    spacing: opts.spacing ?? WHEAT_SPACING,
  });
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
  if (pondBlocksSpot(x, z, 0.35)) return true;
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
export function gardenFlowerSpots(expansionIds = [], furniture = null) {
  const key = expansionIds.length ? [...expansionIds].sort().join('|') : '-';
  const cached = flowerSpotCache.get(key);
  if (cached) return filterSpotsOffPatches(cached, furniture);
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
  return filterSpotsOffPatches(spots, furniture);
}

function filterSpotsOffPatches(spots, furniture) {
  if (!furniture?.patches?.length) return spots;
  return spots.filter((spot) => !spotOnFarmingPatch(spot.x, spot.z, furniture));
}

function gardenSeedRand(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Cluster centers for instanced lawn blades. Filtered like trees when a room is built. */
export function gardenGrassClusters(expansionIds = [], furniture = null) {
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
  return filterSpotsOffPatches(clusters, furniture);
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
