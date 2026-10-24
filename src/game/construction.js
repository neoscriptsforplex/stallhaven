/**
 * Cosmetic furniture from Furniture.rar. Prices are flat materials, not the
 * gold ×3 curve, plus build gold of 1,000 × unlock level. Placing grants Construction XP through xpForBuild. Pick up
 * returns those materials and the build gold paid. Sell pays half the gold value and keeps the materials.
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
  piece({ id: 'basic_bed', scale: 2 / 3, name: 'Basic Bed', category: 'Beds', mount: 'outdoor', level: 20, gold: 600, tint: 0x8a6a4a, materials: { plank: 3, bronze_nails: 4 } }),
  piece({ id: 'double_bed', scale: 2 / 3, name: 'Double Bed', category: 'Beds', mount: 'outdoor', level: 50, gold: 1500, tint: 0x6a3a4a, materials: { willow_plank: 4, steel_nails: 8 } }),
  piece({ id: 'cabinet', scale: 2 / 3, name: 'Cabinet', category: 'Decor', mount: 'outdoor', level: 1, gold: 700, tint: 0xa08050, materials: { oak_plank: 3, iron_nails: 6 } }),
  piece({ id: 'crate', scale: 2 / 3, name: 'Crate', category: 'Storage', mount: 'outdoor', level: 1, gold: 150, tint: 0xb09060, materials: { plank: 2, bronze_nails: 2 } }),
  piece({ id: 'sacks', scale: 2 / 3, name: 'Sacks', category: 'Storage', mount: 'outdoor', level: 1, gold: 100, tint: 0xc2b48a, materials: { plank: 1 } }),
  piece({ id: 'barrel_of_fish', name: 'Barrel of Fish', category: 'Storage', mount: 'outdoor', level: 1, gold: 250, tint: 0x8a6848, materials: { plank: 2, bronze_nails: 2 } }),
  piece({ id: 'barrel_of_sticks', name: 'Barrel of Sticks', category: 'Storage', mount: 'outdoor', level: 1, gold: 200, tint: 0x7a5a32, materials: { plank: 2, bronze_nails: 2 } }),
  piece({ id: 'old_bookshelf', name: 'Old Bookshelf', category: 'Decor', mount: 'outdoor', level: 10, gold: 900, tint: 0x6a4a30, materials: { oak_plank: 4, iron_nails: 6 } }),
  piece({ id: 'fire', scale: 0.5, name: 'Fire', category: 'Light', mount: 'outdoor', level: 5, gold: 100, tint: 0xe07030, materials: { logs: 2 } }),
  piece({ id: 'fireplace', scale: 2 / 3, name: 'Fireplace', category: 'Decor', mount: 'outdoor', level: 1, gold: 1200, tint: 0x8a4030, materials: { willow_plank: 2, steel_nails: 6 } }),
  piece({ id: 'fancy_fireplace', scale: 2 / 3, name: 'Fancy Fireplace', category: 'Decor', mount: 'outdoor', level: 1, gold: 2500, tint: 0xa05030, materials: { maple_plank: 3, mithril_nails: 8 } }),
  // Model Man's fancy rug (Luke approved). Flat walk-over Decor: pieces never block movement.
  piece({ id: 'fancy_rug', scale: 2 / 3, name: 'Fancy Rug', category: 'Decor', mount: 'outdoor', level: 1, gold: 100000, buildGold: 100000, tint: 0x6b0a04, materials: { cloth: 20, flax: 20 } }),
  piece({ id: 'standing_candles', scale: 2 / 3, name: 'Standing Candles', category: 'Decor', mount: 'outdoor', level: 60, gold: 300, tint: 0xe8d090, materials: { plank: 1, bronze_nails: 2 } }),
  piece({ id: 'lit_torch', wallY: 1.1, roll: Math.PI / 2, scale: 0.5, name: 'Lit Torch', category: 'Decor', mount: 'wall', level: 1, gold: 150, tint: 0xe8a040, materials: { logs: 1 } }),
  piece({ id: 'standing_torch', scale: 2 / 3, name: 'Standing Torch', category: 'Light', mount: 'outdoor', level: 1, gold: 200, tint: 0xd09040, materials: { logs: 1, bronze_nails: 2 } }),
  piece({ id: 'portrait', hang: true, name: 'Portrait', category: 'Decor', mount: 'wall', level: 5, gold: 400, tint: 0xc8b090, materials: { oak_plank: 1, iron_nails: 2 } }),
  piece({ id: 'cooking_shelves', hw: 0.61, hd: 0.23, name: 'Cooking Shelves', category: 'Storage', mount: 'outdoor', level: 12, gold: 600, tint: 0xb8874a, materials: { oak_plank: 2, iron_nails: 4 } }),
  piece({ id: 'pots_and_pans', free: true, scale: 1 / 3, name: 'Pots and Pans', category: 'Storage', mount: 'outdoor', level: 1, gold: 0, tint: 0xa0a0a8, materials: {} }),
  piece({ id: 'tapestry', name: 'Tapestry', category: 'Decor', mount: 'wall', level: 28, gold: 1000, tint: 0x8a3a4a, materials: { maple_plank: 2, mithril_nails: 4 } }),
  piece({ id: 'tapestry_pole', name: 'Tapestry Pole', category: 'Decor', mount: 'outdoor', level: 28, gold: 500, tint: 0x8a6840, materials: { oak_plank: 1, iron_nails: 4 } }),
  // Model Man's wall pieces (Luke approved). Back of each model sits on the wall face; wallY keeps the authored height.
  piece({ id: 'wall_plant', hang: true, wallFace: 'outside', wallY: 0.76, name: 'Wall Plant', category: 'Outdoor', mount: 'wall', level: 5, gold: 300, tint: 0x4a7a2a, materials: { plank: 2, bronze_nails: 2 } }),
  piece({ id: 'utensil_rack', hang: true, wallFace: 'inside', wallY: 0.113, name: 'Utensil Rack', category: 'Decor', mount: 'wall', level: 12, gold: 500, tint: 0x8a6a4a, materials: { oak_plank: 2, iron_nails: 4 } }),
  piece({ id: 'pot_shelf', hang: true, wallFace: 'inside', wallY: 0.231, name: 'Pot Shelf', category: 'Decor', mount: 'wall', level: 20, gold: 700, tint: 0xa0704a, materials: { oak_plank: 3, iron_nails: 6 } }),
  piece({ id: 'window_box', hang: true, wallFace: 'inside', wallY: -0.146, name: 'Window Box', category: 'Decor', mount: 'wall', level: 28, gold: 900, tint: 0x6a8a3a, materials: { oak_plank: 4, iron_nails: 6 } }),
  piece({ id: 'landscape', hang: true, name: 'Landscape', category: 'Decor', mount: 'wall', level: 35, gold: 1200, tint: 0x5a8a4a, materials: { maple_plank: 2, mithril_nails: 4 } }),
  // Outdoor-tab copies: same model, cost, level and XP as the Decor piece, outside walls only.
  piece({ id: 'lit_torch_outdoor', model: 'lit_torch', wallFace: 'outside', wallY: 1.1, roll: Math.PI / 2, scale: 0.5, name: 'Lit Torch', category: 'Outdoor', mount: 'wall', level: 1, gold: 150, tint: 0xe8a040, materials: { logs: 1 } }),
  piece({ id: 'window_box_outdoor', model: 'window_box', hang: true, wallFace: 'outside', wallY: -0.146, name: 'Window Box', category: 'Outdoor', mount: 'wall', level: 28, gold: 900, tint: 0x6a8a3a, materials: { oak_plank: 4, iron_nails: 6 } }),
  piece({ id: 'fire_outdoor', model: 'fire', scale: 0.5, name: 'Fire', category: 'Outdoor', mount: 'outdoor', level: 5, gold: 100, tint: 0xe07030, materials: { logs: 2 } }),
  // Light-tab copies of the Decor fireplaces: same model, cost, level and XP.
  piece({ id: 'fireplace_light', model: 'fireplace', scale: 2 / 3, name: 'Fireplace', category: 'Light', mount: 'outdoor', level: 1, gold: 1200, tint: 0x8a4030, materials: { willow_plank: 2, steel_nails: 6 } }),
  piece({ id: 'fancy_fireplace_light', model: 'fancy_fireplace', scale: 2 / 3, name: 'Fancy Fireplace', category: 'Light', mount: 'outdoor', level: 1, gold: 2500, tint: 0xa05030, materials: { maple_plank: 3, mithril_nails: 8 } }),
  piece({ id: 'garden_bush', name: 'Garden Bush', category: 'Outdoor', mount: 'outdoor', level: 1, gold: 120, tint: 0x4a7a2a, materials: { flax: 3 } }),
  piece({ id: 'flag_pole', scale: 0.5, name: 'Flag Pole', category: 'Outdoor', mount: 'outdoor', level: 1, gold: 400, tint: 0xc04040, materials: { oak_plank: 2, iron_nails: 4 } }),
  piece({ id: 'statue', name: 'Statue', category: 'Outdoor', mount: 'outdoor', level: 1, gold: 3000, tint: 0xb0b0b8, materials: { yew_plank: 2, adamant_nails: 6 } }),
  piece({ id: 'log_pile', name: 'Log Pile', category: 'Outdoor', mount: 'outdoor', level: 1, gold: 200, tint: 0x8a6238, materials: { logs: 4 } }),
  piece({ id: 'lumbridge_fountain', name: 'Lumbride Fountain', category: 'Outdoor', mount: 'outdoor', level: 1, gold: 4000, tint: 0x4a88b0, materials: { maple_plank: 4, mithril_nails: 8 } }),
  piece({ id: 'cannon', name: 'Cannon', category: 'Outdoor', mount: 'outdoor', level: 1, gold: 2000, tint: 0x6a6a72, materials: { steel_bar: 4 } }),
  piece({ id: 'blacksmiths_tools', hang: true, scale: 1 / 3, name: "Blacksmiths' Tools", category: 'Decor', mount: 'wall', level: 1, gold: 900, tint: 0x5a5a62, materials: { steel_nails: 8, willow_plank: 1 } }),
  piece({ id: 'sink', scale: 2 / 3, name: 'Sink', category: 'Decor', mount: 'outdoor', level: 1, gold: 700, tint: 0xc8d0d4, materials: { oak_plank: 2, iron_nails: 4 } }),
  piece({ id: 'bank_booth', name: 'Bank Booth', category: 'Decor', mount: 'outdoor', level: 1, gold: 2500, tint: 0x8a6848, materials: { maple_plank: 4, mithril_nails: 10 } }),
  piece({ id: 'suit_of_armour', scale: 2 / 3, name: 'Suit of Armour', category: 'Decor', mount: 'outdoor', level: 1, gold: 1800, tint: 0xb0b0c0, materials: { steel_bar: 2, steel_nails: 6 } }),
]);

/** Pieces taken out of the Build menu. Old saves get these materials back. */
export const RETIRED_PIECES = Object.freeze({
  bush: Object.freeze({ name: 'Bush', gold: 50, materials: Object.freeze({ flax: 2 }) }),
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

/** Model/thumbnail id for a piece: Outdoor/Light copies share their original's model. */
export function pieceModelId(id) {
  return BY_ID[id]?.model ?? id;
}

const GUIDE_ICONS = Object.freeze({ pots_and_pans: 'pot', landscape: 'leaf' });
const GUIDE_DESC = Object.freeze({ Wall: 'Wall decor' });

/** Skill-guide rows: every Build-menu piece that needs more than Construction 1. */
export const CONSTRUCTION_GUIDE = Object.freeze(
  CONSTRUCTION_PIECES.filter((row) => row.level > 1 && !row.model)
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
  CONSTRUCTION_PIECES.filter((row) => row.level > 1 && !row.model).map((row) => ({
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

/** Wall face a wall-mount piece may use: 'inside', 'outside', or null for both. */
export function pieceWallFace(id) {
  const row = constructionPiece(id);
  if (row?.mount !== 'wall') return null;
  return row.wallFace === 'inside' || row.wallFace === 'outside' ? row.wallFace : null;
}

export function constructionLookId(id) {
  return `furn-${pieceModelId(id)}`;
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

/** Gold per Construction unlock level charged to place a piece (on top of materials). */
export const BUILD_GOLD_PER_LEVEL = 1000;

/** Gold to place one piece: 1,000 × unlock level. Pieces flagged `free: true` cost no gold; `buildGold` overrides. */
export function constructionBuildGold(row) {
  if (!row || row.free === true) return 0;
  if (Number.isFinite(row.buildGold)) return Math.max(0, Math.floor(row.buildGold));
  return BUILD_GOLD_PER_LEVEL * Math.max(1, Math.floor(Number(row.level) || 1));
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
  const gold = constructionBuildGold(row);
  const have = Math.max(0, Math.floor(Number(state?.gold) || 0));
  if (have < gold) {
    return `You need ${gold.toLocaleString('en-US')} gp to build ${row.name}. You have ${have.toLocaleString('en-US')} gp.`;
  }
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
  const paid = constructionBuildGold(row);
  state.gold = Math.max(0, Math.round((state.gold ?? 0) - paid));
  list.push({ id: row.id, x: spot.x, z: spot.z, rot: spot.rot, paid });
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

/**
 * Delete / pick up: give the materials back in full, and the build gold
 * actually paid for this piece (`paid`; 0 for pieces from older saves).
 */
export function pickupConstruction(state, index) {
  const list = placedList(state);
  const row = list?.[index];
  const pieceRow = row ? constructionPiece(row.id) : null;
  if (!pieceRow) return false;
  list.splice(index, 1);
  refundMaterials(state, pieceRow);
  const paid = Math.max(0, Math.floor(Number(row.paid) || 0));
  if (paid) state.gold = Math.round((state.gold ?? 0) + paid);
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
      ...(Number(pose.paid) > 0 ? { paid: Math.floor(Number(pose.paid)) } : {}),
    });
  }
  return out;
}

/** Pieces in one Build catalogue tab, sorted by Construction unlock level (stable, ties by gold). */
export function constructionPiecesByLevel(category) {
  return CONSTRUCTION_PIECES
    .filter((row) => row.category === category)
    .map((row, i) => ({ row, i }))
    .sort((a, b) => (a.row.level ?? 1) - (b.row.level ?? 1) || (a.row.gold ?? 0) - (b.row.gold ?? 0) || a.i - b.i)
    .map(({ row }) => row);
}
