/**
 * Cosmetic furniture from Furniture.rar. Prices are flat materials, not the
 * gold ×3 curve. Placing grants Construction XP through xpForBuild. Pick up
 * returns those materials. Sell pays half the gold value and keeps the materials.
 */
import { xpForBuild } from './skills.js';

const piece = (row) => Object.freeze({
  ...row,
  materials: Object.freeze({ ...row.materials }),
});

export const CONSTRUCTION_PIECES = Object.freeze([
  piece({ id: 'chair', scale: 2 / 3, name: 'Chair', category: 'Seating', mount: 'outdoor', level: 5, gold: 200, tint: 0x8a5a32, materials: { plank: 1, bronze_nails: 2 } }),
  piece({ id: 'fancy_chair', scale: 2 / 3, name: 'Fancy Chair', category: 'Seating', mount: 'outdoor', level: 60, gold: 600, tint: 0x6a4428, materials: { oak_plank: 2, iron_nails: 4 } }),
  piece({ id: 'bench', scale: 2 / 3, name: 'Bench', category: 'Seating', mount: 'outdoor', level: 20, gold: 400, tint: 0x8a6840, materials: { oak_plank: 2, iron_nails: 4 } }),
  piece({ id: 'throne', scale: 2 / 3, name: 'Throne', category: 'Seating', mount: 'outdoor', level: 99, gold: 5000, tint: 0xc4a24a, materials: { magic_plank: 4, dragon_nails: 8 } }),
  piece({ id: 'basic_table', scale: 2 / 3, name: 'Basic Table', category: 'Tables', mount: 'outdoor', level: 1, gold: 150, tint: 0xa07848, materials: { plank: 2, bronze_nails: 2 } }),
  piece({ id: 'fancy_table', scale: 2 / 3, name: 'Fancy Table', category: 'Tables', mount: 'outdoor', level: 65, gold: 800, tint: 0xc4a06a, materials: { oak_plank: 3, iron_nails: 6 } }),
  piece({ id: 'double_bed', scale: 2 / 3, name: 'Double Bed', category: 'Beds', mount: 'outdoor', level: 50, gold: 1500, tint: 0x6a3a4a, materials: { willow_plank: 4, steel_nails: 8 } }),
  piece({ id: 'cabinet', scale: 2 / 3, name: 'Cabinet', category: 'Storage', mount: 'outdoor', level: 1, gold: 700, tint: 0xa08050, materials: { oak_plank: 3, iron_nails: 6 } }),
  piece({ id: 'crate', scale: 2 / 3, name: 'Crate', category: 'Storage', mount: 'outdoor', level: 1, gold: 150, tint: 0xb09060, materials: { plank: 2, bronze_nails: 2 } }),
  piece({ id: 'sacks', scale: 2 / 3, name: 'Sacks', category: 'Storage', mount: 'outdoor', level: 1, gold: 100, tint: 0xc2b48a, materials: { plank: 1 } }),
  piece({ id: 'barrel_of_fish', name: 'Barrel of Fish', category: 'Storage', mount: 'outdoor', level: 1, gold: 250, tint: 0x8a6848, materials: { plank: 2, bronze_nails: 2 } }),
  piece({ id: 'barrel_of_sticks', name: 'Barrel of Sticks', category: 'Storage', mount: 'outdoor', level: 1, gold: 200, tint: 0x7a5a32, materials: { plank: 2, bronze_nails: 2 } }),
  piece({ id: 'old_bookshelf', name: 'Old Bookshelf', category: 'Storage', mount: 'outdoor', level: 10, gold: 900, tint: 0x6a4a30, materials: { oak_plank: 4, iron_nails: 6 } }),
  piece({ id: 'fire', name: 'Fire', category: 'Light', mount: 'outdoor', level: 5, gold: 100, tint: 0xe07030, materials: { logs: 2 } }),
  piece({ id: 'fireplace', scale: 2 / 3, name: 'Fireplace', category: 'Light', mount: 'outdoor', level: 1, gold: 1200, tint: 0x8a4030, materials: { willow_plank: 2, steel_nails: 6 } }),
  piece({ id: 'fancy_fireplace', scale: 2 / 3, name: 'Fancy Fireplace', category: 'Light', mount: 'outdoor', level: 1, gold: 2500, tint: 0xa05030, materials: { maple_plank: 3, mithril_nails: 8 } }),
  piece({ id: 'standing_candles', scale: 2 / 3, name: 'Standing Candles', category: 'Light', mount: 'outdoor', level: 60, gold: 300, tint: 0xe8d090, materials: { plank: 1, bronze_nails: 2 } }),
  piece({ id: 'lit_torch', wallY: 1.35, name: 'Lit Torch', category: 'Light', mount: 'wall', level: 1, gold: 150, tint: 0xe8a040, materials: { logs: 1 } }),
  piece({ id: 'standing_torch', scale: 2 / 3, name: 'Standing Torch', category: 'Light', mount: 'outdoor', level: 1, gold: 200, tint: 0xd09040, materials: { logs: 1, bronze_nails: 2 } }),
  piece({ id: 'portrait', hang: true, name: 'Portrait', category: 'Wall', mount: 'wall', level: 5, gold: 400, tint: 0xc8b090, materials: { oak_plank: 1, iron_nails: 2 } }),
  piece({ id: 'cooking_shelves', hw: 0.61, hd: 0.23, name: 'Cooking Shelves', category: 'Storage', mount: 'outdoor', level: 12, gold: 600, tint: 0xb8874a, materials: { oak_plank: 2, iron_nails: 4 } }),
  piece({ id: 'pots_and_pans', scale: 1 / 3, name: 'Pots and Pans', category: 'Storage', mount: 'outdoor', level: 20, gold: 800, tint: 0xa0a0a8, materials: { willow_plank: 2, steel_nails: 4 } }),
  piece({ id: 'tapestry', name: 'Tapestry', category: 'Wall', mount: 'wall', level: 28, gold: 1000, tint: 0x8a3a4a, materials: { maple_plank: 2, mithril_nails: 4 } }),
  piece({ id: 'tapestry_pole', name: 'Tapestry Pole', category: 'Storage', mount: 'outdoor', level: 28, gold: 500, tint: 0x8a6840, materials: { oak_plank: 1, iron_nails: 4 } }),
  piece({ id: 'landscape', hang: true, name: 'Landscape', category: 'Wall', mount: 'wall', level: 35, gold: 1200, tint: 0x5a8a4a, materials: { maple_plank: 2, mithril_nails: 4 } }),
  piece({ id: 'bush', scale: 2 / 3, name: 'Bush', category: 'Outdoor', mount: 'outdoor', level: 1, gold: 50, tint: 0x4a8a3a, materials: { flax: 2 } }),
  piece({ id: 'garden_bush', name: 'Garden Bush', category: 'Outdoor', mount: 'outdoor', level: 1, gold: 120, tint: 0x4a7a2a, materials: { flax: 3 } }),
  piece({ id: 'flag_pole', name: 'Flag Pole', category: 'Outdoor', mount: 'outdoor', level: 1, gold: 400, tint: 0xc04040, materials: { oak_plank: 2, iron_nails: 4 } }),
  piece({ id: 'statue', name: 'Statue', category: 'Outdoor', mount: 'outdoor', level: 1, gold: 3000, tint: 0xb0b0b8, materials: { yew_plank: 2, adamant_nails: 6 } }),
  piece({ id: 'log_pile', name: 'Log Pile', category: 'Outdoor', mount: 'outdoor', level: 1, gold: 200, tint: 0x8a6238, materials: { logs: 4 } }),
  piece({ id: 'lumbridge_fountain', name: 'Lumbride Fountain', category: 'Outdoor', mount: 'outdoor', level: 1, gold: 4000, tint: 0x4a88b0, materials: { maple_plank: 4, mithril_nails: 8 } }),
  piece({ id: 'cannon', name: 'Cannon', category: 'Outdoor', mount: 'outdoor', level: 1, gold: 2000, tint: 0x6a6a72, materials: { steel_bar: 4 } }),
  piece({ id: 'blacksmiths_tools', scale: 2 / 3, name: "Blacksmiths' Tools", category: 'Workshop', mount: 'outdoor', level: 1, gold: 900, tint: 0x5a5a62, materials: { steel_nails: 8, willow_plank: 1 } }),
  piece({ id: 'sink', scale: 2 / 3, name: 'Sink', category: 'Workshop', mount: 'outdoor', level: 1, gold: 700, tint: 0xc8d0d4, materials: { oak_plank: 2, iron_nails: 4 } }),
  piece({ id: 'bank_booth', name: 'Bank Booth', category: 'Workshop', mount: 'outdoor', level: 1, gold: 2500, tint: 0x8a6848, materials: { maple_plank: 4, mithril_nails: 10 } }),
  piece({ id: 'suit_of_armour', scale: 2 / 3, name: 'Suit of Armour', category: 'Decor', mount: 'outdoor', level: 1, gold: 1800, tint: 0xb0b0c0, materials: { steel_bar: 2, steel_nails: 6 } }),
]);

/** Pieces taken out of the Build menu. Old saves get these materials back. */
export const RETIRED_PIECES = Object.freeze({
});

/** Materials owed for retired pieces still listed in an old save. */
export function retiredRefund(saved) {
  const out = {};
  if (!Array.isArray(saved)) return out;
  for (const pose of saved) {
    const gone = RETIRED_PIECES[pose?.id];
    if (!gone) continue;
    for (const [id, count] of Object.entries(gone.materials)) out[id] = (out[id] ?? 0) + count;
  }
  return out;
}

const BY_ID = Object.fromEntries(CONSTRUCTION_PIECES.map((row) => [row.id, row]));

const GUIDE_ICONS = Object.freeze({ pots_and_pans: 'pot', landscape: 'leaf' });
const GUIDE_DESC = Object.freeze({ Wall: 'Wall decor' });

/** Skill-guide rows: every Build-menu piece that needs more than Construction 1. */
export const CONSTRUCTION_GUIDE = Object.freeze(
  CONSTRUCTION_PIECES.filter((row) => row.level > 1)
    .sort((a, b) => a.level - b.level)
    .map((row) => ({
      lv: row.level,
      name: row.name,
      desc: GUIDE_DESC[row.category] ?? row.category,
      icon: GUIDE_ICONS[row.id] ?? 'house',
      tint: `#${row.tint.toString(16).padStart(6, '0')}`,
    })),
);

export const CONSTRUCTION_UNLOCKS = Object.freeze(
  CONSTRUCTION_PIECES.filter((row) => row.level > 1).map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level,
  })),
);

export function constructionPiece(id) {
  return BY_ID[id] ?? null;
}

/**
 * Build-menu categories each Shop furniture card (index.html data-shop-furniture) shows in.
 * Shelves and mannequins also sit under Storage; nowhere else.
 */
export const SHOP_FURNITURE_CATEGORIES = Object.freeze({
  table: Object.freeze(['Shop']),
  shelf: Object.freeze(['Shop', 'Storage']),
  mannequin: Object.freeze(['Shop', 'Storage']),
});

export function shopFurnitureInCategory(kind, category) {
  return (SHOP_FURNITURE_CATEGORIES[kind] ?? ['Shop']).includes(category);
}

export function constructionCategories() {
  const seen = [];
  for (const row of CONSTRUCTION_PIECES) {
    if (!seen.includes(row.category)) seen.push(row.category);
  }
  return seen;
}

/** Wall art keeps its model height (hangs at picture height) instead of dropping to the floor. */
export function pieceHangs(id) {
  const row = constructionPiece(id);
  return row?.mount === 'wall' && row.hang === true;
}

export function constructionLookId(id) {
  return `furn-${id}`;
}

function plankMap(row) {
  const planks = {};
  for (const [id, count] of Object.entries(row.materials)) {
    if (id === 'plank' || id.endsWith('_plank')) planks[id] = count;
  }
  return planks;
}

export function constructionXpFor(row) {
  return xpForBuild({ kind: 'item', gp: row?.gold ?? 0, planks: plankMap(row ?? { materials: {} }) });
}

export function missingMaterials(state, row) {
  const missing = [];
  for (const [id, need] of Object.entries(row?.materials ?? {})) {
    const have = Math.max(0, Math.floor(Number(state?.materials?.[id]) || 0));
    if (have < need) missing.push({ id, need, have });
  }
  return missing;
}

export function constructionPlaceBlock(state, pieceId) {
  const row = constructionPiece(pieceId);
  if (!row) return 'Unknown furniture.';
  const level = state?.skills?.getLevel?.('construction') ?? 1;
  if (level < row.level) {
    return `You need a Construction level of ${row.level} to build ${row.name}.`;
  }
  if (missingMaterials(state, row).length) return 'Missing materials.';
  return '';
}

function pay(state, row) {
  for (const [id, count] of Object.entries(row.materials)) {
    state.materials[id] = Math.max(0, (state.materials[id] ?? 0) - count);
  }
}

function refundMaterials(state, row) {
  for (const [id, count] of Object.entries(row.materials)) {
    state.materials[id] = (state.materials[id] ?? 0) + count;
  }
}

function placedList(state) {
  if (!state.furniture) return null;
  if (!Array.isArray(state.furniture.placed)) state.furniture.placed = [];
  return state.furniture.placed;
}

function cleanPose(pose) {
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return null;
  const rot = Number.isFinite(pose.rot) ? pose.rot : 0;
  return { x: pose.x, z: pose.z, rot };
}

/** Spend the flat material cost and record one cosmetic piece. No gold. */
export function placeConstruction(state, pieceId, pose) {
  const row = constructionPiece(pieceId);
  const spot = cleanPose(pose);
  if (!row || !spot || constructionPlaceBlock(state, pieceId)) return false;
  const list = placedList(state);
  if (!list) return false;
  pay(state, row);
  list.push({ id: row.id, x: spot.x, z: spot.z, rot: spot.rot });
  state.skills?.addXp?.('construction', constructionXpFor(row));
  return true;
}

/** Move or turn a placed piece. Nothing is spent and no XP is granted. */
export function moveConstruction(state, index, pose) {
  const list = placedList(state);
  const spot = cleanPose(pose);
  const row = list?.[index];
  if (!row || !spot || !constructionPiece(row.id)) return false;
  row.x = spot.x;
  row.z = spot.z;
  row.rot = spot.rot;
  return true;
}

/** Remove a piece and give the materials back. Gold stays spent. */
export function pickupConstruction(state, index) {
  const list = placedList(state);
  const row = list?.[index];
  const pieceRow = row ? constructionPiece(row.id) : null;
  if (!pieceRow) return false;
  list.splice(index, 1);
  refundMaterials(state, pieceRow);
  return true;
}

/** Remove a piece and pay half its gold value. Materials are not returned. */
export function sellConstruction(state, index) {
  const list = placedList(state);
  const row = list?.[index];
  const pieceRow = row ? constructionPiece(row.id) : null;
  if (!pieceRow) return false;
  list.splice(index, 1);
  const gold = Math.floor(pieceRow.gold * 0.5);
  state.gold = Math.max(0, Math.round((state.gold ?? 0) + gold));
  return gold;
}

export function readPlacedFurniture(saved) {
  if (!Array.isArray(saved)) return [];
  const out = [];
  for (const pose of saved) {
    const row = constructionPiece(pose?.id);
    if (!row || !Number.isFinite(pose?.x) || !Number.isFinite(pose?.z)) continue;
    out.push({
      id: row.id,
      x: pose.x,
      z: pose.z,
      rot: Number.isFinite(pose.rot) ? pose.rot : 0,
    });
  }
  return out;
}
