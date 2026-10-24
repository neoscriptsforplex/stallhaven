import {
  ARMOUR_SLOTS,
  CUSTOMERS,
  DEFAULT_SKYBOX,
  MATERIALS,
  METALS,
  OTHER_CHANCE,
  RECIPES,
  canDisplayOn,
  isCraftedMaterial,
  isMinedMaterial,
  isFishMaterial,
  fishYield,
  isMaterialCraft,
  CHOP_YIELD,
  FLAX_YIELD,
  FOUNTAIN_DURATION,
  FOUNTAIN_WATER_YIELD,
  WHEAT_YIELD,
  mineYield,
  GROW_BY_ID,
  HERB_GROW_YIELD,
  SHOP,
  SHELF_SLOT_COUNT,
  SHOP_MAX_LEVEL,
  SKYBOXES,
  START_GOLD,
  defaultAppearance,
  displayKind,
  emptyShelfSlots,
  emptySlots,
  formatGold,
  isHandOrFootWare,
  matchingArmourIds,
  masteryNeed,
  MASTERY_SPEED,
  normalizeAppearance,
  offerClassLabel,
  isCraftHidden,
  offerClassOf,
  recipeCost,
  recipeList,
  stationForRecipe,
  scheduleKingRoald,
} from './catalog.js';
import {
  MAX_XP,
  SKILL_IDS,
  createSkills,
  levelRequirementText,
  meetsLevelRequirement,
  skillForRecipe,
  skillLevelOf,
  xpForBuild,
  xpForCraft,
  xpForExpansion,
  xpForLevel,
  xpForMine,
  xpFromCraftHistory,
  ESSENCE_DOUBLE_LEVEL,
  essencePerBar,
  pickYieldFor,
} from './skills.js';
import { RUNE_DOUBLE_LEVEL_MULT } from './skillLevels.js';
import { emptyHeroQuestState, isMaterialFull, materialCap, normalizeHeroQuestState } from './heroesQuests.js';
import {
  CAULDRON_COST,
  WHEEL_COST,
  FURNACE_COST,
  RANGE_COST,
  PORTAL_COST,
  SAWMILL_COST,
  STATION_UNLOCKS,
  CHEST_MAX_LEVEL,
  FURNITURE_FORWARD,
  SWAP_PRICE_RATIO,
  chestSlots,
  chestUpgradeCost,
  cloneFurniture,
  defaultFurniture,
  emptyMaterialAcc,
  expansionCost,
  MAX_EXPANSIONS,
  furnitureBuyCost,
  furnitureBuildParts,
  furnitureKindForType,
  furnitureLabelForType,
  FURNITURE_SHOP,
  FARMING_PATCH_CAP,
  FARMING_PATCH_COSTS,
  farmingPatchPoseKept,
  migrateStarterMannequins,
  padById,
  padConnects,
  snapToWallGrid,
  stationUnlock,
} from './layout.js';
import { readPlacedFurniture, retiredRefund } from './construction.js';
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  DEFAULT_BRIGHTNESS,
  DEFAULT_DUNGEON_BRIGHTNESS,
  clampBrightness,
  clampDungeonBrightness,
  readStoredBrightness,
  readStoredDungeonBrightness,
  readStoredPhotoMode,
} from './lighting.js';

export {
  CAULDRON_COST,
  WHEEL_COST,
  FURNACE_COST,
  RANGE_COST,
  PORTAL_COST,
  SAWMILL_COST,
  STATION_UNLOCKS,
  furnitureBuyCost,
  masteryNeed,
  MASTERY_SPEED,
  formatGold,
  SHOP_MAX_LEVEL,
  DEFAULT_SKYBOX,
  SKYBOXES,
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  DEFAULT_BRIGHTNESS,
};

export const SAVE_VERSION = 15;
/** Ore counts were copied onto bars before save version 11. Later saves must not run that again. */
const ORE_BAR_MIGRATION_VERSION = 11;
export const OLD_DEFAULT_DISPLAYS = 8;
export const DEFAULT_MUSIC_VOLUME = 0.75;

function emptyBoughtFurniture() {
  return { table: 0, mannequin: 0, shelf: 0, farming_patch: 0 };
}

export const FREE_FURNITURE_REPLACE = 2;

function emptyFreeFurnitureReplace() {
  return { table: 0, mannequin: 0, farming_patch: 0 };
}

/** Old saves used ores for smithing. Copy ore counts onto bars so progress is not bricked. */
function migrateLegacyMetalBars(next, data) {
  const version = data.version ?? 0;
  if (version >= ORE_BAR_MIGRATION_VERSION) return;
  for (const metal of METALS) {
    const barId = `${metal.id}_bar`;
    const savedBar = data.materials?.[barId];
    if (typeof savedBar === 'number' && Number.isFinite(savedBar)) {
      next.materials[barId] = Math.max(0, Math.round(savedBar));
      continue;
    }
    next.materials[barId] = next.materials[metal.id] ?? 0;
  }
  next.materials.bow_string = 0;
}

/**
 * v13: cooking needs raw fish from the pond, and the bought generic "Fish" is
 * gone. Move any saved Fish onto Raw salmon (the level-1 catch) so a stocked
 * kitchen keeps cooking.
 */
function migrateGenericFish(next, data) {
  if ((data.version ?? 0) >= 13) return;
  // Old saves never had the 3 starting salmon; give them exactly their old Fish.
  const raw = data.materials?.fish;
  const old = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, raw) : 0;
  const saved = data.materials?.raw_salmon;
  const cur = typeof saved === 'number' && Number.isFinite(saved) ? Math.max(0, Math.round(saved)) : 0;
  const level = typeof data.chestLevel === 'number' && Number.isFinite(data.chestLevel)
    ? data.chestLevel
    : next.chestLevel;
  next.materials.raw_salmon = Math.min(materialCap(level), cur + Math.round(old));
}

/**
 * v15 raises Fishing and Cooking requirements to the OSRS levels for fish this
 * game has. A save that already met the old requirement is lifted to the new
 * one, so salmon (and the rest) stay open. New games stay at level 1.
 * Old requirement, then the new one. Anglerfish did not move.
 */
const FISHING_LEVEL_CATCHUP = [
  [1, 30],
  [20, 40],
  [40, 62],
  [60, 76],
];
const COOKING_LEVEL_CATCHUP = [
  [10, 25],
];

function raiseSkillFloor(skills, skill, pairs) {
  const level = skills.getLevel(skill);
  let floor = 1;
  for (const [oldNeed, newNeed] of pairs) {
    if (level >= oldNeed) floor = Math.max(floor, newNeed);
  }
  const need = xpForLevel(floor);
  const have = skills.getXp(skill);
  if (have < need) skills.addXp(skill, need - have);
}

function catchUpRaisedFishLevels(state, data) {
  if ((data.version ?? 0) >= 15 || !state.skills?.getLevel) return;
  raiseSkillFloor(state.skills, 'fishing', FISHING_LEVEL_CATCHUP);
  raiseSkillFloor(state.skills, 'cooking', COOKING_LEVEL_CATCHUP);
}

export function skyboxId(id) {
  return SKYBOXES.some((item) => item.id === id) ? id : DEFAULT_SKYBOX;
}

/** XP granted for finishing a ware. Higher catalog tiers give more. */
export function craftXp(recipe) {
  const tier = Math.max(1, recipe?.tier ?? 1);
  return 6 + tier * 10;
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNextLevel(level) {
  const lv = Math.max(1, Math.min(SHOP_MAX_LEVEL, Math.round(Number(level) || 1)));
  if (lv >= SHOP_MAX_LEVEL) return 0;
  return Math.floor(35 + lv * 16 + lv * lv * 1.8);
}

export function shopProgress(xp = 0) {
  const total = Math.max(0, Math.round(Number(xp) || 0));
  let level = 1;
  let remain = total;
  while (level < SHOP_MAX_LEVEL) {
    const need = xpToNextLevel(level);
    if (remain < need) break;
    remain -= need;
    level += 1;
  }
  const need = xpToNextLevel(level);
  return {
    level,
    xp: total,
    xpIntoLevel: remain,
    xpForLevel: need,
    t: need > 0 ? Math.min(1, remain / need) : 1,
  };
}

export function grantShopXp(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return 0;
  const before = shopProgress(state.shopXp ?? 0);
  if (before.level >= SHOP_MAX_LEVEL) {
    state.shopLevel = SHOP_MAX_LEVEL;
    return 0;
  }
  const gained = craftXp(recipe);
  state.shopXp = (state.shopXp ?? 0) + gained;
  const after = shopProgress(state.shopXp);
  state.shopLevel = after.level;
  return gained;
}

export function applyCheat(state, raw) {
  const code = String(raw ?? '').trim().toLowerCase();
  if (code === '-motherlode') {
    const before = state.gold ?? 0;
    state.gold = Math.max(0, before - 10000);
    return '-motherlode';
  }
  if (code === 'motherlode') {
    state.gold = (state.gold ?? 0) + 1000000;
    return 'motherlode';
  }
  if (code === 'noob') {
    cancelCrafts(state);
    state.gold = START_GOLD;
    state.craftCounts = {};
    state.expansions = [];
    state.chestLevel = 1;
    if (state.furniture) {
      for (const station of STATION_UNLOCKS) state.furniture[station.id] = null;
    }
    if (state.materials) {
      state.materials.flax = MATERIALS.flax.start;
      state.materials.wheat = MATERIALS.wheat.start;
    }
    if (state.materialAcc) {
      state.materialAcc.flax = 0;
      state.materialAcc.wheat = 0;
    }
    state.skills?.reset?.();
    return 'noob';
  }
  if (code === 'freshstart') {
    const skills = state.skills;
    const next = createState();
    for (const key of Object.keys(next)) {
      if (key === 'skills') continue;
      state[key] = next[key];
    }
    if (skills?.reset) skills.reset();
    else state.skills = next.skills;
    state.crafts = {};
    state.ready = [];
    state.log = [];
    return 'freshstart';
  }
  if (code === 'maxcape') {
    if (!state.craftCounts) state.craftCounts = {};
    for (const recipe of recipeList()) {
      const need = Math.max(masteryNeed(recipe), recipe.unlockNeed ?? 0, 80);
      state.craftCounts[recipe.id] = Math.max(state.craftCounts[recipe.id] ?? 0, need);
    }
    if (state.skills?.fromJSON) {
      state.skills.fromJSON({
        xp: Object.fromEntries(SKILL_IDS.map((id) => [id, xpForLevel(99)])),
      });
    }
    return 'maxcape';
  }
  if (code === 'maxresource') {
    if (!state.materials) state.materials = {};
    const cap = storageCap(state);
    for (const id of Object.keys(MATERIALS)) state.materials[id] = cap;
    return 'maxresource';
  }
  if (code === 'onesmallfavour') {
    state.chefHat = true;
    return 'onesmallfavour';
  }
  return null;
}

function emptyDisplay(spot) {
  const kind = spot?.kind ?? 'table';
  return {
    ware: null,
    furnitureId: null,
    slots: emptySlots(),
    shelfSlots: kind === 'shelf' ? emptyShelfSlots() : null,
    kind,
    name: spot?.name ?? (kind === 'stand' ? 'Mannequin' : kind === 'shelf' ? 'Shelf' : 'Table'),
    bought: Boolean(spot?.bought),
    removed: Boolean(spot?.removed),
  };
}

function readSavedDisplay(saved, fallback) {
  const base = emptyDisplay(fallback);
  if (!saved || typeof saved !== 'object') return base;
  const kind = saved.kind === 'shelf' || saved.kind === 'stand' || saved.kind === 'table'
    ? saved.kind
    : base.kind;
  const wareId = saved.ware?.recipeId;
  const slots = emptySlots();
  if (saved.slots && typeof saved.slots === 'object') {
    for (const slot of ARMOUR_SLOTS) {
      const id = saved.slots[slot];
      slots[slot] = RECIPES[id] ? id : null;
    }
  }
  const shelfSlots = kind === 'shelf' ? emptyShelfSlots() : null;
  if (shelfSlots && Array.isArray(saved.shelfSlots)) {
    for (let slot = 0; slot < SHELF_SLOT_COUNT; slot += 1) {
      const id = saved.shelfSlots[slot];
      shelfSlots[slot] = RECIPES[id] ? id : null;
    }
  } else if (shelfSlots && RECIPES[wareId] && !shelfSlots.some(Boolean)) {
    shelfSlots[0] = wareId;
  }
  return {
    ware: RECIPES[wareId] ? { recipeId: wareId } : null,
    furnitureId: saved.furnitureId ?? null,
    slots,
    shelfSlots,
    kind,
    name: typeof saved.name === 'string' && saved.name ? saved.name : base.name,
    bought: Boolean(saved.bought || fallback?.bought),
    removed: Boolean(saved.removed || fallback?.removed),
  };
}

export function createState() {
  const materials = {};
  for (const mat of Object.values(MATERIALS)) {
    materials[mat.id] = mat.start;
  }
  return {
    gold: START_GOLD,
    materials,
    materialAcc: emptyMaterialAcc(materials),
    crafts: {},
    craftCounts: {},
    chest: {},
    chestLevel: 1,
    ready: [],
    displays: SHOP.displays.map((spot) => emptyDisplay(spot)),
    furniture: defaultFurniture(),
    expansions: [],
    selectedDisplay: 0,
    wareLooks: {},
    fullscreen: false,
    music: { volume: DEFAULT_MUSIC_VOLUME, loop: false, track: '' },
    boughtFurniture: emptyBoughtFurniture(),
    freeFurnitureReplace: emptyFreeFurnitureReplace(),
    shopXp: 0,
    shopLevel: 1,
    skybox: DEFAULT_SKYBOX,
    brightness: readStoredBrightness(),
    dungeonBrightness: readStoredDungeonBrightness(),
    photoMode: readStoredPhotoMode(),
    chefHat: false,
    appearance: defaultAppearance(),
    playTime: 0,
    kingRoaldAt: scheduleKingRoald(0),
    log: [],
    skills: createSkills(),
    hq: emptyHeroQuestState(),
  };
}

export function craftCount(state, recipeId) {
  return state.craftCounts?.[recipeId] ?? 0;
}

export function unlockRemaining(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (recipe?.unlockAnyOf?.length) {
    const need = recipe.unlockNeed ?? 0;
    const best = Math.max(0, ...recipe.unlockAnyOf.map((id) => craftCount(state, id)));
    return Math.max(0, need - best);
  }
  if (!recipe?.previousId) return 0;
  return Math.max(0, (recipe.unlockNeed ?? 0) - craftCount(state, recipe.previousId));
}

export function chestCapacity(state) {
  return chestSlots(state.chestLevel ?? 1);
}

export function chestHasSpace(state, extra = 1) {
  return chestTotal(state) + extra <= chestCapacity(state);
}

/** True when the station that makes this recipe is placed (anvil and altars always count). */
export function recipeStationOwned(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return false;
  if (recipe.category === 'potion' && !ownsCauldron(state)) return false;
  if (recipe.category === 'food' && !ownsRange(state)) return false;
  if (recipe.category === 'smelt' && !ownsFurnace(state)) return false;
  if (recipe.category === 'spin' && !ownsWheel(state)) return false;
  const station = stationForRecipe(recipe);
  if (['loom', 'fletch', 'potter', 'sawmill'].includes(station) && !ownsStation(state, station)) return false;
  return true;
}

export function isUnlocked(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return false;
  if (recipe.category === 'potion' && !ownsCauldron(state)) return false;
  if (recipe.category === 'food' && !ownsRange(state)) return false;
  if (recipe.category === 'smelt' && !ownsFurnace(state)) return false;
  if (recipe.category === 'spin' && !ownsWheel(state)) return false;
  if (stationForRecipe(recipe) === 'loom' && !ownsStation(state, 'loom')) return false;
  if (stationForRecipe(recipe) === 'fletch' && !ownsStation(state, 'fletch')) return false;
  if (stationForRecipe(recipe) === 'potter' && !ownsStation(state, 'potter')) return false;
  if (stationForRecipe(recipe) === 'sawmill' && !ownsStation(state, 'sawmill')) return false;
  return meetsLevelRequirement(recipe, (skillId) => skillLevelOf(state, skillId));
}

/**
 * The craft-count ladder from before skills, used only to grandfather old saves.
 * The multicannon was already Smithing 99, so a save that never made one does
 * not inherit level 99 from it.
 */
function legacyChainUnlocked(state, recipe) {
  if (!recipe) return false;
  if (recipe.id === 'dwarven_multicannon' && craftCount(state, recipe.id) < 1) return false;
  if (recipe.category === 'potion' && !ownsCauldron(state)) return false;
  if (recipe.category === 'food' && !ownsRange(state)) return false;
  if (recipe.category === 'smelt' && !ownsFurnace(state)) return false;
  if (recipe.category === 'spin' && !ownsWheel(state)) return false;
  if (stationForRecipe(recipe) === 'loom' && !ownsStation(state, 'loom')) return false;
  if (stationForRecipe(recipe) === 'fletch' && !ownsStation(state, 'fletch')) return false;
  if (stationForRecipe(recipe) === 'potter' && !ownsStation(state, 'potter')) return false;
  if (stationForRecipe(recipe) === 'sawmill' && !ownsStation(state, 'sawmill')) return false;
  if (recipe.unlockAnyOf?.length) {
    const need = recipe.unlockNeed ?? 0;
    return recipe.unlockAnyOf.some((id) => craftCount(state, id) >= need);
  }
  if (!recipe.previousId) return true;
  return craftCount(state, recipe.previousId) >= (recipe.unlockNeed ?? 0);
}

function planksFor(buildId, index = 0) {
  const planks = {};
  for (const part of furnitureBuildParts(buildId, index)) {
    if (part.kind !== 'planks' || !part.count) continue;
    planks[part.id] = (planks[part.id] ?? 0) + part.count;
  }
  return planks;
}

function constructionXp(kind, gp, buildId = null, index = 0) {
  return xpForBuild({
    kind,
    gp,
    planks: buildId ? planksFor(buildId, index) : null,
  });
}

/** XP an old save should have, from crafts, bars smelted, and placements. */
function skillCatchUp(source) {
  const seeded = xpFromCraftHistory(source.craftCounts, RECIPES, stationForRecipe);
  for (const metal of METALS) {
    const n = Math.max(0, Math.floor(Number(source.craftCounts?.[`smelt_${metal.id}`]) || 0));
    if (!n) continue;
    seeded.xp.mining = Math.min(MAX_XP, seeded.xp.mining + n * xpForMine(metal.id));
  }
  let construction = seeded.xp.construction ?? 0;
  const rooms = source.expansions ?? [];
  for (let i = 0; i < rooms.length; i += 1) construction += xpForExpansion(i);
  for (const station of STATION_UNLOCKS) {
    if (!source.furniture?.[station.id]) continue;
    construction += constructionXp('station', station.cost ?? 0, station.id);
  }
  for (const type of ['table', 'mannequin', 'shelf']) {
    const n = Math.max(0, Math.floor(Number(source.boughtFurniture?.[type]) || 0));
    for (let i = 0; i < n; i += 1) {
      construction += constructionXp('item', furnitureBuyCost(i), type);
    }
  }
  seeded.xp.construction = Math.min(MAX_XP, construction);
  for (const recipe of recipeList()) {
    if (!legacyChainUnlocked(source, recipe)) continue;
    const req = recipe.requires;
    if (!req?.skill || !Object.prototype.hasOwnProperty.call(seeded.xp, req.skill)) continue;
    const floor = xpForLevel(req.level);
    if (seeded.xp[req.skill] < floor) seeded.xp[req.skill] = floor;
  }
  return seeded;
}

/** Per-material storage cap. Chest level 1 keeps the old flat 250. */
export function storageCap(state) {
  return materialCap(state?.chestLevel);
}

export function materialIsFull(state, materialId) {
  return isMaterialFull(state?.materials, materialId, storageCap(state));
}

/** "Logs full." / "Bucket of water full." Shared by chop, mine, pick, fountain, and later fishing. */
export function gatherFullMessage(materialId) {
  const name = MATERIALS[materialId]?.name ?? 'Storage';
  return `${name} full.`;
}

export function craftBlockReason(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return 'Unknown recipe.';
  if (isCraftHidden(recipe)) return 'That item cannot be crafted.';
  if (recipe.category === 'potion' && !ownsCauldron(state)) {
    return 'Place a cauldron from Build to brew potions.';
  }
  if (recipe.category === 'food' && !ownsRange(state)) {
    return 'Place a cooking range from Build to bake food.';
  }
  if (recipe.category === 'smelt' && !ownsFurnace(state)) {
    return 'Place a furnace from Build to smelt ores into bars.';
  }
  if (recipe.category === 'spin' && !ownsWheel(state)) {
    return 'Place a spinning wheel from Build to spin flax into bow string.';
  }
  if (stationForRecipe(recipe) === 'loom' && !ownsStation(state, 'loom')) {
    return 'Place a loom from Build to weave cloth and armour.';
  }
  if (stationForRecipe(recipe) === 'fletch' && !ownsStation(state, 'fletch')) {
    return 'Place a fletching bench from Build to make ranged weapons and ammo.';
  }
  if (stationForRecipe(recipe) === 'potter' && !ownsStation(state, 'potter')) {
    return 'Place a Potter Wheel from Build to soften hard clay.';
  }
  if (recipe.category === 'rune' && !ownsStation(state, 'portal')) {
    return 'Place the portal from Build to craft runes.';
  }
  if (stationForRecipe(recipe) === 'sawmill' && !ownsStation(state, 'sawmill')) {
    return 'Place a sawmill from Build to saw logs into planks.';
  }
  if (!meetsLevelRequirement(recipe, (skillId) => skillLevelOf(state, skillId))) {
    return levelRequirementText(recipe);
  }
  if (!isUnlocked(state, recipeId)) {
    const remain = unlockRemaining(state, recipeId);
    const prev = recipe.previousId ? RECIPES[recipe.previousId] : null;
    return `Locked. Craft ${remain} more ${prev?.name ?? 'item'} first.`;
  }
  if (state.crafts[recipeId]) return `${recipe.name} is already in progress.`;
  if (!isMaterialCraft(recipe) && !chestHasSpace(state, recipe.outputCount ?? 1)) return 'The chest is full.';
  if (isMaterialCraft(recipe) && materialIsFull(state, recipe.outputMaterial)) return 'Storage full.';
  const cost = recipeCost(recipe);
  if ((cost.gold || 0) > state.gold) return `Need ${formatGold(cost.gold)}g more.`;
  for (const [materialId, need] of Object.entries(cost.materials)) {
    const have = state.materials[materialId] ?? 0;
    if (have < need) {
      const missing = need - have;
      const name = MATERIALS[materialId]?.name ?? materialId;
      return `Need ${missing} more ${name}.`;
    }
  }
  for (const [itemId, need] of Object.entries(cost.items ?? {})) {
    const have = chestCount(state, itemId);
    if (have < need) {
      const name = RECIPES[itemId]?.name ?? itemId;
      return `Need ${need - have} more ${name}.`;
    }
  }
  return null;
}

export function isMastered(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return false;
  return craftCount(state, recipeId) >= masteryNeed(recipe);
}

export function craftDuration(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return 0;
  return isMastered(state, recipeId) ? recipe.time * MASTERY_SPEED : recipe.time;
}

export function masteredIds(state) {
  return recipeList()
    .filter((recipe) => isMastered(state, recipe.id))
    .map((recipe) => recipe.id);
}

export function canCraft(state, recipeId) {
  return craftBlockReason(state, recipeId) == null;
}

/** How many more recipe actions can be paid for with current gold, mats, and chest space. */
export function maxCraftActions(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return 0;
  if (isCraftHidden(recipe)) return 0;
  if (recipe.category === 'potion' && !ownsCauldron(state)) return 0;
  if (recipe.category === 'food' && !ownsRange(state)) return 0;
  if (recipe.category === 'smelt' && !ownsFurnace(state)) return 0;
  if (recipe.category === 'spin' && !ownsWheel(state)) return 0;
  if (stationForRecipe(recipe) === 'loom' && !ownsStation(state, 'loom')) return 0;
  if (stationForRecipe(recipe) === 'fletch' && !ownsStation(state, 'fletch')) return 0;
  if (stationForRecipe(recipe) === 'potter' && !ownsStation(state, 'potter')) return 0;
  if (!meetsLevelRequirement(recipe, (skillId) => skillLevelOf(state, skillId))) return 0;
  if (!isUnlocked(state, recipeId)) return 0;
  const cost = recipeCost(recipe);
  let max = Infinity;
  for (const [materialId, need] of Object.entries(cost.materials ?? {})) {
    if (!need) continue;
    max = Math.min(max, Math.floor((state.materials[materialId] ?? 0) / need));
  }
  for (const [itemId, need] of Object.entries(cost.items ?? {})) {
    if (!need) continue;
    max = Math.min(max, Math.floor(chestCount(state, itemId) / need));
  }
  if ((cost.gold || 0) > 0) {
    max = Math.min(max, Math.floor(state.gold / cost.gold));
  }
  if (!isMaterialCraft(recipe)) {
    const out = Math.max(1, recipe.outputCount ?? 1);
    const reserved = (state.crafts[recipeId]?.left ?? 0) * out;
    const free = chestCapacity(state) - chestTotal(state) - reserved;
    max = Math.min(max, Math.floor(Math.max(0, free) / out));
  } else if (MATERIALS[recipe.outputMaterial]) {
    const out = Math.max(1, recipe.outputCount ?? 1);
    const reserved = (state.crafts[recipeId]?.left ?? 0) * out;
    const free = storageCap(state) - (state.materials[recipe.outputMaterial] ?? 0) - reserved;
    max = Math.min(max, Math.floor(Math.max(0, free) / out));
  }
  if (!Number.isFinite(max)) return 0;
  return Math.max(0, Math.floor(max));
}

function payCraftCost(state, recipe, times) {
  const cost = recipeCost(recipe);
  const n = Math.max(0, Math.round(Number(times) || 0));
  state.gold -= (cost.gold || 0) * n;
  for (const [materialId, need] of Object.entries(cost.materials ?? {})) {
    state.materials[materialId] = (state.materials[materialId] ?? 0) - need * n;
  }
  for (const [itemId, need] of Object.entries(cost.items ?? {})) {
    const left = chestCount(state, itemId) - need * n;
    if (left > 0) state.chest[itemId] = left;
    else delete state.chest[itemId];
  }
}

function refundCraftCost(state, recipe, times) {
  const cost = recipeCost(recipe);
  const n = Math.max(0, Math.round(Number(times) || 0));
  state.gold += (cost.gold || 0) * n;
  for (const [materialId, need] of Object.entries(cost.materials ?? {})) {
    state.materials[materialId] = (state.materials[materialId] ?? 0) + need * n;
  }
  for (const [itemId, need] of Object.entries(cost.items ?? {})) {
    addToChest(state, itemId, need * n);
  }
}

/** Stop a running craft or leftover batch. Refunds remaining actions; finished items stay. */
export function cancelCraft(state, recipeId) {
  const craft = state.crafts?.[recipeId];
  const recipe = RECIPES[recipeId];
  if (!craft || !recipe) return 0;
  const remaining = Math.max(0, craft.left ?? 1);
  if (remaining > 0) refundCraftCost(state, recipe, remaining);
  delete state.crafts[recipeId];
  return remaining;
}

export function cancelCrafts(state) {
  let refunded = 0;
  for (const recipeId of Object.keys(state.crafts ?? {})) {
    refunded += cancelCraft(state, recipeId);
  }
  return refunded;
}

export function busyCraftId(state) {
  return Object.keys(state.crafts ?? {})[0] ?? null;
}

export function startCraft(state, recipeId, nowSeconds) {
  return startCraftBatch(state, recipeId, 1, nowSeconds) > 0;
}

/** Queue `want` actions (or as many as affordable). Returns how many were queued. */
export function startCraftBatch(state, recipeId, want, nowSeconds) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return 0;
  const cap = maxCraftActions(state, recipeId);
  const asked = want === Infinity || want === 'max' ? cap : Math.max(0, Math.round(Number(want) || 0));
  const n = Math.min(cap, asked);
  if (n < 1) return 0;
  payCraftCost(state, recipe, n);
  const existing = state.crafts[recipeId];
  if (existing) {
    existing.left = (existing.left ?? 1) + n;
    existing.total = (existing.total ?? 1) + n;
    return n;
  }
  state.crafts[recipeId] = {
    startedAt: nowSeconds,
    duration: craftDuration(state, recipeId),
    left: n,
    total: n,
  };
  return n;
}

export function craftProgress(state, recipeId, nowSeconds) {
  const craft = state.crafts[recipeId];
  if (!craft) return null;
  const elapsed = nowSeconds - craft.startedAt;
  const left = Math.max(0, craft.duration - elapsed);
  const currentT = craft.duration > 0 ? Math.min(1, elapsed / craft.duration) : 1;
  const remaining = craft.left ?? 1;
  const total = Math.max(remaining, craft.total ?? remaining);
  const done = Math.max(0, total - remaining);
  return {
    left,
    duration: craft.duration,
    t: total > 0 ? (done + currentT) / total : currentT,
    currentT,
    remaining,
    total,
    done,
  };
}

export function chestCount(state, recipeId) {
  return state.chest[recipeId] ?? 0;
}

export function chestTotal(state) {
  return Object.values(state.chest).reduce((sum, n) => sum + n, 0);
}

export function chestList(state) {
  return Object.entries(state.chest)
    .filter(([, count]) => count > 0)
    .map(([recipeId, count]) => ({ recipeId, count, recipe: RECIPES[recipeId] }))
    .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name));
}

export function addToChest(state, recipeId, amount = 1) {
  if (!RECIPES[recipeId]) return false;
  const n = Math.max(1, Math.round(Number(amount) || 1));
  state.chest[recipeId] = chestCount(state, recipeId) + n;
  if (state.ready) state.ready = chestReadyIds(state);
  return true;
}

export function discardFromChest(state, recipeId, amount = 1) {
  const have = chestCount(state, recipeId);
  if (have < 1) return 0;
  const n = Math.min(have, Math.max(1, Math.round(Number(amount) || 1)));
  const left = have - n;
  if (left) state.chest[recipeId] = left;
  else delete state.chest[recipeId];
  if (state.ready) state.ready = chestReadyIds(state);
  return n;
}

export function backWallShelfIndex() {
  return SHOP.displays.findIndex((spot) => spot.id === 'shelf-center');
}

export function clearBackWallShelf(state) {
  const index = backWallShelfIndex();
  if (index < 0) return false;
  return removePlacedFurniture(state, index);
}

export function canUpgradeChest(state) {
  const level = state.chestLevel ?? 1;
  if (level >= CHEST_MAX_LEVEL) return false;
  return state.gold >= chestUpgradeCost(level);
}

export function upgradeChest(state) {
  if (!canUpgradeChest(state)) return false;
  const level = state.chestLevel ?? 1;
  const cost = chestUpgradeCost(level);
  state.gold -= cost;
  state.chestLevel = level + 1;
  return true;
}

export function canBuyExpansion(state, padId) {
  const pad = padById(padId);
  if (!pad) return false;
  if ((state.expansions ?? []).includes(padId)) return false;
  if ((state.expansions ?? []).length >= MAX_EXPANSIONS) return false;
  if (!padConnects(pad, state.expansions ?? [])) return false;
  return state.gold >= expansionCost((state.expansions ?? []).length);
}

export function buyExpansion(state, padId) {
  if (!canBuyExpansion(state, padId)) return false;
  const roomsBefore = (state.expansions ?? []).length;
  const cost = expansionCost(roomsBefore);
  state.gold -= cost;
  state.expansions = [...(state.expansions ?? []), padId];
  state.skills?.addXp('construction', xpForExpansion(roomsBefore));
  if (padId === 'back') clearBackWallShelf(state);
  return true;
}

export function stationCost(id) {
  return STATION_UNLOCKS.find((item) => item.id === id)?.cost ?? 0;
}

export function ownsStation(state, id) {
  return Boolean(state.furniture?.[id]);
}

function buildIndex(state, id) {
  return id === 'farming_patch' ? boughtFurnitureCount(state, id) : 0;
}

function buildParts(state, id) {
  return furnitureBuildParts(id, buildIndex(state, id));
}

export function hasBuildMaterials(state, id) {
  return buildParts(state, id).every((part) => (state.materials?.[part.id] ?? 0) >= part.count);
}

function payBuildMaterials(state, id) {
  for (const part of buildParts(state, id)) {
    state.materials[part.id] = (state.materials[part.id] ?? 0) - part.count;
  }
}

/** "Bronze Nails ×8 · Plank ×4", or empty when the piece spends no stock. */
export function buildMaterialLabel(id, index = 0) {
  return furnitureBuildParts(id, index)
    .map((part) => `${MATERIALS[part.id]?.name ?? part.id} ×${formatGold(part.count)}`)
    .join(' · ');
}

/** "Needs: Iron Nails ×6 (have 2) · Oak Plank ×2 (have 0)", or empty. */
export function buildMaterialNeedLine(state, id) {
  const parts = buildParts(state, id);
  if (!parts.length) return '';
  const bits = parts.map((part) => {
    const name = MATERIALS[part.id]?.name ?? part.id;
    const have = state.materials?.[part.id] ?? 0;
    return `${name} ×${formatGold(part.count)} (have ${formatGold(have)})`;
  });
  return `Needs: ${bits.join(' · ')}`;
}

/** Empty when the player already holds every nail and plank on the row. */
export function buildMaterialBlock(state, id) {
  const missing = buildParts(state, id).filter((part) => (state.materials?.[part.id] ?? 0) < part.count);
  if (!missing.length) return '';
  const bits = missing.map((part) => {
    const name = MATERIALS[part.id]?.name ?? part.id;
    const have = state.materials?.[part.id] ?? 0;
    return `${name} ×${formatGold(part.count)} (have ${formatGold(have)})`;
  });
  return `Need ${bits.join(' and ')}.`;
}

export function canBuyStation(state, id) {
  const unlock = stationUnlock(id);
  if (!unlock) return false;
  if (ownsStation(state, id) || state.gold < unlock.cost) return false;
  return hasBuildMaterials(state, id);
}

export function stationPlaceBlock(state, id) {
  const label = (stationUnlock(id)?.label ?? id).toLowerCase();
  if (ownsStation(state, id)) return `A ${label} is already placed.`;
  const cost = stationCost(id);
  if ((state.gold ?? 0) < cost) {
    return `Need ${formatGold(cost)}g to buy a ${label}. You have ${formatGold(state.gold)}g.`;
  }
  return buildMaterialBlock(state, id);
}

export function buyStation(state, id, pose) {
  if (!pose || !canBuyStation(state, id)) return false;
  const cost = stationCost(id);
  state.gold -= cost;
  payBuildMaterials(state, id);
  state.furniture[id] = {
    x: pose.x,
    z: pose.z,
    rot: pose.rot ?? FURNITURE_FORWARD,
  };
  state.skills?.addXp('construction', constructionXp('station', cost, id));
  return true;
}

export function ownsCauldron(state) {
  return ownsStation(state, 'cauldron');
}

export function canBuyCauldron(state) {
  return canBuyStation(state, 'cauldron');
}

export function buyCauldron(state, pose) {
  return buyStation(state, 'cauldron', pose);
}

export function ownsFurnace(state) {
  return ownsStation(state, 'furnace');
}

export function ownsRange(state) {
  return ownsStation(state, 'range');
}

export function canBuyFurnace(state) {
  return canBuyStation(state, 'furnace');
}

export function buyFurnace(state, pose) {
  return buyStation(state, 'furnace', pose);
}

export function canBuyRange(state) {
  return canBuyStation(state, 'range');
}

export function buyRange(state, pose) {
  return buyStation(state, 'range', pose);
}

export function ownsWheel(state) {
  return ownsStation(state, 'wheel');
}

export function canBuyWheel(state) {
  return canBuyStation(state, 'wheel');
}

export function buyWheel(state, pose) {
  return buyStation(state, 'wheel', pose);
}

export function boughtFurnitureCount(state, type) {
  return Math.max(0, state.boughtFurniture?.[type] ?? 0);
}

export function includedFurnitureCount(type) {
  const kind = furnitureKindForType(type);
  return SHOP.displays.filter((spot) => (spot.kind ?? 'table') === kind).length;
}

export function liveFurnitureCount(state, type) {
  const kind = furnitureKindForType(type);
  return (state.displays ?? []).filter((display, index) => (
    !display?.removed && displayKind(index, state) === kind
  )).length;
}

export function nextFurnitureCost(state, type) {
  if (type === 'farming_patch') {
    if ((state.freeFurnitureReplace?.farming_patch ?? 0) > 0) return 0;
    const n = Math.min(boughtFurnitureCount(state, type), FARMING_PATCH_CAP - 1);
    return FARMING_PATCH_COSTS[Math.max(0, n)];
  }
  if (type === 'shelf') {
    const live = liveFurnitureCount(state, 'shelf');
    const included = includedFurnitureCount('shelf');
    if (live < included) return 0;
    return furnitureBuyCost(Math.max(0, live - included));
  }
  if ((type === 'table' || type === 'mannequin') && (state.freeFurnitureReplace?.[type] ?? 0) > 0) {
    return 0;
  }
  return furnitureBuyCost(boughtFurnitureCount(state, type));
}

export function canBuyFurniture(state, type) {
  if (!FURNITURE_SHOP.some((item) => item.type === type)) return false;
  // Tables, mannequins, and shelves have no count cap. Price is
  // furnitureBuyCost(n) = 500·3^n. Farming patches stay capped.
  if (type === 'farming_patch') {
    const placed = Array.isArray(state.furniture?.patches) ? state.furniture.patches.length : 0;
    const credit = Math.max(0, state.freeFurnitureReplace?.farming_patch ?? 0);
    if (placed >= FARMING_PATCH_CAP) return false;
    if (credit <= 0 && boughtFurnitureCount(state, type) >= FARMING_PATCH_CAP) return false;
  }
  const cost = nextFurnitureCost(state, type);
  if ((state.gold ?? 0) < cost) return false;
  if (cost === 0) return true;
  return hasBuildMaterials(state, type);
}

export function furnitureNeedGold(state, type) {
  const cost = nextFurnitureCost(state, type);
  const have = state.gold ?? 0;
  if (have >= cost) return '';
  const label = furnitureLabelForType(type).toLowerCase();
  return `Need ${formatGold(cost)}g to buy a ${label}. You have ${formatGold(have)}g.`;
}

/** Gold first, then nails and planks. Free replacements and included shelves skip materials. */
export function furniturePlaceBlock(state, type) {
  const gold = furnitureNeedGold(state, type);
  if (gold) return gold;
  if (nextFurnitureCost(state, type) === 0) return '';
  return buildMaterialBlock(state, type);
}

export function buyFurniture(state, type, pose) {
  if (!canBuyFurniture(state, type) || !pose) return false;
  const kind = furnitureKindForType(type);
  const cost = nextFurnitureCost(state, type);
  const materialIndex = type === 'farming_patch' ? boughtFurnitureCount(state, type) : 0;
  state.gold -= cost;
  if (cost > 0) payBuildMaterials(state, type);
  if (!state.boughtFurniture) state.boughtFurniture = emptyBoughtFurniture();
  if (!state.freeFurnitureReplace) state.freeFurnitureReplace = emptyFreeFurnitureReplace();
  if (cost === 0 && (type === 'table' || type === 'mannequin' || type === 'farming_patch') && state.freeFurnitureReplace[type] > 0) {
    state.freeFurnitureReplace[type] -= 1;
  }
  const paidExtra = cost > 0;
  if (paidExtra) {
    state.boughtFurniture[type] = boughtFurnitureCount(state, type) + 1;
    state.skills?.addXp('construction', constructionXp('item', cost, type, materialIndex));
  }
  if (type === 'farming_patch') {
    if (!state.furniture) state.furniture = defaultFurniture();
    if (!Array.isArray(state.furniture.patches)) state.furniture.patches = [];
    state.furniture.patches.push({
      x: pose.x,
      z: pose.z,
      rot: pose.rot ?? FURNITURE_FORWARD,
      paid: paidExtra,
      crop: null,
    });
    return true;
  }
  const n = liveFurnitureCount(state, type) + 1;
  const label = furnitureLabelForType(type);
  state.displays.push(emptyDisplay({
    kind,
    name: paidExtra ? `${label} ${n}` : label,
    bought: paidExtra,
  }));
  if (!state.furniture.displays) state.furniture.displays = defaultFurniture().displays;
  state.furniture.displays.push({
    x: pose.x,
    z: pose.z,
    rot: pose.rot ?? FURNITURE_FORWARD,
  });
  state.selectedDisplay = state.displays.length - 1;
  return true;
}

function returnDisplayWares(state, display) {
  const ids = [];
  if (Array.isArray(display.shelfSlots)) {
    for (const id of display.shelfSlots) {
      if (id) ids.push(id);
    }
  } else {
    for (const id of Object.values(display.slots ?? {})) {
      if (id) ids.push(id);
    }
    if (display.ware?.recipeId) ids.push(display.ware.recipeId);
  }
  for (const id of ids) addToChest(state, id);
  display.ware = null;
  display.slots = emptySlots();
  display.shelfSlots = display.kind === 'shelf' ? emptyShelfSlots() : null;
}

/** Clear a mannequin, table, or shelf. Table and shelf wares go back to the chest. */
export function clearDisplay(state, index) {
  const display = state.displays[index];
  if (!display || display.removed) return false;
  const kind = displayKind(index, state);
  if (kind !== 'shelf' && kind !== 'table' && kind !== 'stand') return false;
  if (kind === 'stand') {
    display.ware = null;
    display.slots = emptySlots();
    return true;
  }
  returnDisplayWares(state, display);
  return true;
}

export function removePlacedFurniture(state, index) {
  const display = state.displays[index];
  if (!display || display.removed) return false;
  const kind = displayKind(index, state);
  if (kind !== 'shelf' && kind !== 'table' && kind !== 'stand') return false;
  returnDisplayWares(state, display);
  display.removed = true;
  const type = kind === 'stand' ? 'mannequin' : kind === 'shelf' ? 'shelf' : 'table';
  if (!state.boughtFurniture) state.boughtFurniture = emptyBoughtFurniture();
  if (display.bought) {
    state.boughtFurniture[type] = Math.max(0, boughtFurnitureCount(state, type) - 1);
  }
  if (type === 'table' || type === 'mannequin') {
    if (!state.freeFurnitureReplace) state.freeFurnitureReplace = emptyFreeFurnitureReplace();
    state.freeFurnitureReplace[type] = Math.min(
      FREE_FURNITURE_REPLACE,
      (state.freeFurnitureReplace[type] ?? 0) + 1,
    );
  }
  if (state.selectedDisplay === index) {
    const next = state.displays.findIndex((item) => !item.removed);
    state.selectedDisplay = next >= 0 ? next : 0;
  }
  return true;
}

/**
 * Delete one farming patch.
 * A paid patch refunds the current top tier (gold, nails, and planks, uncapped)
 * and frees that tier for the next buy. A free-credit patch refunds nothing and
 * restores one free place. Anything growing on it is lost.
 */
export function removeFarmingPatch(state, index) {
  const patches = state.furniture?.patches;
  if (!Array.isArray(patches) || !Number.isInteger(index) || index < 0 || index >= patches.length) return false;
  const pose = patches[index];
  if (pose?.paid === false) {
    if (!state.freeFurnitureReplace) state.freeFurnitureReplace = emptyFreeFurnitureReplace();
    const room = Math.max(0, FARMING_PATCH_CAP - (patches.length - 1));
    state.freeFurnitureReplace.farming_patch = Math.min(
      room,
      (state.freeFurnitureReplace.farming_patch ?? 0) + 1,
    );
  } else {
    if (!state.boughtFurniture) state.boughtFurniture = emptyBoughtFurniture();
    const bought = boughtFurnitureCount(state, 'farming_patch');
    const tier = Math.max(0, Math.min(FARMING_PATCH_COSTS.length - 1, bought - 1));
    state.gold = (state.gold ?? 0) + (FARMING_PATCH_COSTS[tier] ?? 0);
    for (const part of furnitureBuildParts('farming_patch', tier)) {
      state.materials[part.id] = (state.materials[part.id] ?? 0) + part.count;
    }
    state.boughtFurniture.farming_patch = Math.max(0, bought - 1);
  }
  patches.splice(index, 1);
  return true;
}

/** Move a placed patch. The crop stays on the same object. */
export function moveFarmingPatch(state, index, pose) {
  const patch = state.furniture?.patches?.[index];
  if (!patch || !pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return false;
  patch.x = pose.x;
  patch.z = pose.z;
  if (Number.isFinite(pose.rot)) patch.rot = pose.rot;
  return true;
}

/** Plant one herb. `now` is wall-clock milliseconds, not the room clock. */
export function plantHerb(state, index, recipeId, now = Date.now()) {
  const recipe = GROW_BY_ID[recipeId];
  const patch = state.furniture?.patches?.[index];
  if (!patch || !recipe || patch.crop) return false;
  const level = state.skills?.getLevel?.('farming') ?? 1;
  if (level < recipe.level) return false;
  const start = Number.isFinite(now) ? now : Date.now();
  patch.crop = {
    id: recipe.id,
    startedAt: start,
    endsAt: start + recipe.seconds * 1000,
  };
  return true;
}

/**
 * Harvest a finished crop. Returns how many herbs landed.
 * A full chest leaves the crop in the ground. A short stack grants what fits and clears it.
 */
export function harvestHerb(state, index, now = Date.now()) {
  const patch = state.furniture?.patches?.[index];
  const crop = patch?.crop;
  if (!crop) return 0;
  const when = Number.isFinite(now) ? now : Date.now();
  if (when < crop.endsAt) return 0;
  const recipe = GROW_BY_ID[crop.id];
  if (!recipe) return 0;
  const got = grantMaterial(state, recipe.product, HERB_GROW_YIELD);
  if (got <= 0) return 0;
  state.skills?.addXp('farming', recipe.xp);
  patch.crop = null;
  return got;
}

export function reducedSalePrice(listPrice) {
  return Math.max(1, Math.round((listPrice ?? 0) * SWAP_PRICE_RATIO));
}

export function offerChoices(state, requestRecipeId) {
  const want = RECIPES[requestRecipeId];
  const cls = offerClassOf(want);
  return chestList(state)
    .filter((item) => item.recipe && item.recipeId !== requestRecipeId)
    .filter((item) => offerClassOf(item.recipe) === cls)
    .map(({ recipe, recipeId, count }) => ({
      recipeId,
      name: recipe.name,
      count,
      gold: reducedSalePrice(recipe.price),
      listPrice: recipe.price,
      offerClass: cls,
    }));
}

export function swapOffer(state, customerId, requestRecipeId) {
  const customer = CUSTOMERS[customerId];
  if (!customer) return null;
  const want = RECIPES[requestRecipeId];
  const cls = offerClassOf(want);
  const owned = recipeList().filter((recipe) => (
    recipe.id !== requestRecipeId
    && hasStock(state, recipe.id)
    && offerClassOf(recipe) === cls
  ));
  const preferred = owned.filter((recipe) => customer.prefers.includes(recipe.id));
  const pool = preferred.length ? preferred : owned;
  if (!pool.length) return null;
  pool.sort((a, b) => {
    const da = Math.abs((a.price ?? 0) - (want?.price ?? 0));
    const db = Math.abs((b.price ?? 0) - (want?.price ?? 0));
    return da - db;
  });
  const recipe = pool[0];
  return {
    recipeId: recipe.id,
    gold: reducedSalePrice(recipe.price),
    listPrice: recipe.price,
  };
}

export function tickMaterials(state, dt) {
  // Quests will later change how better materials are earned.
  if (!state.materialAcc) state.materialAcc = emptyMaterialAcc(state.materials);
  for (const mat of Object.values(MATERIALS)) {
    const every = mat.regenEvery;
    if (mat.crafted || !every || every <= 0) continue;
    const cur = state.materials[mat.id] ?? 0;
    const cap = storageCap(state);
    if (cur >= cap) {
      state.materialAcc[mat.id] = 0;
      continue;
    }
    state.materialAcc[mat.id] = (state.materialAcc[mat.id] ?? 0) + dt / every;
    const add = Math.floor(state.materialAcc[mat.id]);
    if (add <= 0) continue;
    state.materialAcc[mat.id] -= add;
    state.materials[mat.id] = Math.min(cap, cur + add);
  }
}

function displayHolds(display, recipeId) {
  if (display.ware?.recipeId === recipeId) return true;
  if (display.shelfSlots?.includes(recipeId)) return true;
  return ARMOUR_SLOTS.some((slot) => display.slots?.[slot] === recipeId);
}

export function hasStock(state, recipeId) {
  if (chestCount(state, recipeId) > 0) return true;
  return state.displays.some((d) => displayHolds(d, recipeId));
}

export function takeStock(state, recipeId) {
  if (chestCount(state, recipeId) > 0) {
    state.chest[recipeId] -= 1;
    if (state.chest[recipeId] <= 0) delete state.chest[recipeId];
    refreshShowcases(state);
    if (state.ready) state.ready = chestReadyIds(state);
    return true;
  }
  const display = state.displays.find((d) => displayHolds(d, recipeId));
  if (!display) return false;
  if (display.slots) {
    for (const slot of ARMOUR_SLOTS) {
      if (display.slots[slot] === recipeId) display.slots[slot] = null;
    }
  }
  if (display.shelfSlots) {
    const slotIndex = display.shelfSlots.indexOf(recipeId);
    if (slotIndex >= 0) display.shelfSlots[slotIndex] = null;
  }
  if (display.ware?.recipeId === recipeId) {
    const leftover = display.shelfSlots?.find(Boolean);
    display.ware = leftover ? { recipeId: leftover } : null;
  }
  refreshShowcases(state);
  return true;
}

/**
 * Runecrafting is the only skill that doubles a craft. At twice the rune's
 * required level the altar gives 2 runes. Air 2, Water 10, Earth 18, Fire 28.
 */
export function craftedOutputCount(state, recipe) {
  const base = Math.max(1, recipe?.outputCount ?? 1);
  if (recipe?.category !== 'rune') return base;
  const need = Math.max(1, recipe.requires?.level ?? 1);
  const level = state.skills?.getLevel?.('runecrafting') ?? 1;
  return level >= need * RUNE_DOUBLE_LEVEL_MULT ? base * 2 : base;
}

function finishOneCraft(state, recipeId) {
  const recipe = RECIPES[recipeId];
  const n = craftedOutputCount(state, recipe);
  if (isMaterialCraft(recipe) && MATERIALS[recipe.outputMaterial]) {
    const cur = state.materials[recipe.outputMaterial] ?? 0;
    const room = Math.max(0, storageCap(state) - cur);
    const add = Math.min(n, room);
    if (add <= 0) return 0;
    state.materials[recipe.outputMaterial] = cur + add;
  } else {
    addToChest(state, recipeId, n);
  }
  if (!state.craftCounts) state.craftCounts = {};
  state.craftCounts[recipeId] = craftCount(state, recipeId) + 1;
  grantShopXp(state, recipeId);
  const skillId = skillForRecipe(recipe, stationForRecipe(recipe));
  if (skillId) state.skills?.addXp(skillId, xpForCraft(recipe));
  return n;
}

export function completeCrafts(state, nowSeconds) {
  const finished = [];
  for (const [recipeId, startCraftState] of Object.entries(state.crafts)) {
    let craft = startCraftState;
    while (craft && nowSeconds - craft.startedAt >= craft.duration) {
      const finishAt = craft.startedAt + craft.duration;
      const produced = finishOneCraft(state, recipeId);
      if (produced === 0) {
        const recipe = RECIPES[recipeId];
        const remaining = Math.max(0, craft.left ?? 1);
        if (remaining > 0 && recipe) refundCraftCost(state, recipe, remaining);
        delete state.crafts[recipeId];
        craft = null;
        continue;
      }
      finished.push(recipeId);
      const remaining = (craft.left ?? 1) - 1;
      if (remaining > 0) {
        craft = {
          startedAt: finishAt,
          duration: craftDuration(state, recipeId),
          left: remaining,
          total: craft.total ?? remaining + 1,
        };
        state.crafts[recipeId] = craft;
      } else {
        delete state.crafts[recipeId];
        craft = null;
      }
    }
  }
  if (finished.length) refreshShowcases(state);
  return finished;
}

function shownIds(state) {
  const shown = new Set();
  for (const display of state.displays) {
    if (display.ware) shown.add(display.ware.recipeId);
    if (display.slots) {
      for (const slot of ARMOUR_SLOTS) {
        if (display.slots[slot]) shown.add(display.slots[slot]);
      }
    }
    for (const id of display.shelfSlots ?? []) {
      if (id) shown.add(id);
    }
  }
  return shown;
}

function fillStandSet(display, recipeId, ownedIds) {
  display.slots = matchingArmourIds(recipeId, ownedIds);
  const filled = ARMOUR_SLOTS.map((slot) => display.slots[slot]).filter(Boolean);
  display.ware = filled.length ? { recipeId: filled.includes(recipeId) ? recipeId : filled[0] } : null;
}

function migrateShelfSlots(display, index, state) {
  if (displayKind(index, state) !== 'shelf') {
    if (!display.shelfSlots) display.shelfSlots = null;
    return;
  }
  if (!Array.isArray(display.shelfSlots) || display.shelfSlots.length !== SHELF_SLOT_COUNT) {
    const next = emptyShelfSlots();
    if (Array.isArray(display.shelfSlots)) {
      for (let i = 0; i < Math.min(SHELF_SLOT_COUNT, display.shelfSlots.length); i += 1) {
        next[i] = display.shelfSlots[i] ?? null;
      }
    }
    display.shelfSlots = next;
  }
  if (display.ware?.recipeId && !display.shelfSlots.some(Boolean)) {
    display.shelfSlots[0] = display.ware.recipeId;
  }
}

export function refreshShowcases(state) {
  for (const [index, display] of state.displays.entries()) {
    if (!display.slots) display.slots = emptySlots();
    migrateShelfSlots(display, index, state);
    const kind = displayKind(index, state);
    if (kind === 'stand') {
      clearMannequinHandsAndFeet(state, display);
      for (const slot of ARMOUR_SLOTS) {
        const id = display.slots[slot];
        if (id && chestCount(state, id) < 1) display.slots[slot] = null;
      }
      const focus = display.ware?.recipeId;
      if (focus && !isHandOrFootWare(focus) && chestCount(state, focus) > 0 && RECIPES[focus]?.category === 'armour') {
        fillStandSet(display, focus, Object.keys(state.chest).filter((id) => chestCount(state, id) > 0));
      } else {
        const filled = ARMOUR_SLOTS.map((slot) => display.slots[slot]).filter(Boolean);
        display.ware = filled.length ? { recipeId: filled[0] } : null;
      }
    } else if (kind === 'shelf') {
      const filled = (display.shelfSlots ?? emptyShelfSlots()).find(Boolean);
      display.ware = filled ? { recipeId: filled } : null;
    }
  }

  const shown = shownIds(state);
  const chestIds = Object.keys(state.chest).filter((id) => state.chest[id] > 0);

  for (const [index, display] of state.displays.entries()) {
    if (displayKind(index, state) !== 'stand') continue;
    if (ARMOUR_SLOTS.some((slot) => display.slots[slot])) continue;
    const next = chestIds.find((id) => (
      !shown.has(id) && RECIPES[id]?.category === 'armour' && !isHandOrFootWare(id)
    ));
    if (!next) continue;
    fillStandSet(display, next, chestIds);
    for (const slot of ARMOUR_SLOTS) {
      if (display.slots[slot]) shown.add(display.slots[slot]);
    }
  }
}

function takeFromChest(state, recipeId) {
  if (chestCount(state, recipeId) < 1) return false;
  state.chest[recipeId] -= 1;
  if (state.chest[recipeId] <= 0) delete state.chest[recipeId];
  if (state.ready) state.ready = chestReadyIds(state);
  return true;
}

function claimLoadedDisplays(state) {
  for (const [index, display] of state.displays.entries()) {
    const kind = displayKind(index, state);
    if (kind === 'shelf') {
      migrateShelfSlots(display, index, state);
      for (let slot = 0; slot < SHELF_SLOT_COUNT; slot += 1) {
        const id = display.shelfSlots[slot];
        if (id && chestCount(state, id) > 0) takeFromChest(state, id);
      }
      const filled = display.shelfSlots.find(Boolean);
      display.ware = filled ? { recipeId: filled } : null;
    } else if (kind !== 'stand' && display.ware?.recipeId && chestCount(state, display.ware.recipeId) > 0) {
      takeFromChest(state, display.ware.recipeId);
    }
  }
}

export function chestDisplayList(state, kind) {
  return chestList(state).filter((item) => canDisplayOn(kind, item.recipe));
}

function grantMaterial(state, materialId, amount) {
  const cur = state.materials[materialId] ?? 0;
  const add = Math.min(storageCap(state) - cur, Math.max(0, Math.round(Number(amount) || 0)));
  if (add <= 0) return 0;
  state.materials[materialId] = cur + add;
  return add;
}

/** Essence per filled bar: 1, then +1 at Mining 25, 50, 75 and 99. Other rocks are unchanged. */
export function minedGrantAmount(state, materialId, amount = mineYield(materialId)) {
  const n = Math.max(0, Math.round(Number(amount) || 0));
  if (materialId === 'essence') return n * essencePerBar(state.skills?.getLevel?.('mining') ?? 1);
  return n;
}

/** Flax or wheat per finished pick: 2 from Farming 15 (flax) or 40 (wheat). */
export function pickYield(state, crop) {
  return pickYieldFor(crop === 'wheat' ? 'wheat' : 'flax', state?.skills?.getLevel?.('farming') ?? 1);
}

export function grantMinedMaterial(state, materialId, amount = mineYield(materialId)) {
  if (!isMinedMaterial(materialId)) return 0;
  return grantMaterial(state, materialId, minedGrantAmount(state, materialId, amount));
}

/** Ore one finished mining bar adds. The progress bar shows this same number. */
export function miningBarAmount(state, materialId, amount = mineYield(materialId)) {
  if (!isMinedMaterial(materialId)) return 0;
  const want = minedGrantAmount(state, materialId, amount);
  const have = Math.max(0, state?.materials?.[materialId] ?? 0);
  return Math.min(want, Math.max(0, storageCap(state) - have));
}

export function grantChoppedLogs(state, amount = CHOP_YIELD, materialId = 'logs') {
  const id = MATERIALS[materialId]?.log ? materialId : 'logs';
  return grantMaterial(state, id, amount);
}

/** One completed catch bar at a pond fishing spot. Caps like every other gathered good. */
export function grantCaughtFish(state, materialId, amount = fishYield(materialId)) {
  if (!isFishMaterial(materialId)) return 0;
  return grantMaterial(state, materialId, amount);
}

export function grantPickedFlax(state, amount = pickYield(state, 'flax')) {
  return grantMaterial(state, 'flax', amount);
}

export function grantPickedWheat(state, amount = pickYield(state, 'wheat')) {
  return grantMaterial(state, 'wheat', amount);
}

/** One completed fountain fill. Caps at the material limit, same as other gathered goods. */
export function grantFountainWater(state, amount = FOUNTAIN_WATER_YIELD) {
  return grantMaterial(state, 'water', amount);
}

/** Gather session for drawing buckets. The bar matches mining, flax, and woodcutting. */
export function createFountainFill(now = 0) {
  return {
    mode: 'fill',
    materialId: 'water',
    name: 'Buckets of water',
    verb: 'Filling',
    startedAt: now,
    duration: FOUNTAIN_DURATION,
    yield: FOUNTAIN_WATER_YIELD,
  };
}

/**
 * Advance a fountain fill. Before the bar finishes, nothing is granted.
 * A finished bar adds the yield and restarts. A full inventory ends the loop.
 */
export function advanceFountainFill(state, session, now) {
  if (!session || now - session.startedAt < session.duration) {
    return { ready: false, got: 0, full: false, session };
  }
  const got = grantFountainWater(state, session.yield ?? FOUNTAIN_WATER_YIELD);
  if (got <= 0) return { ready: true, got: 0, full: true, session: null };
  return {
    ready: true,
    got,
    full: false,
    session: { ...session, startedAt: now },
  };
}

/** Quest reward. Adds Molten Glass straight into materials (id `molten_glass`). */
export function grantMoltenGlass(state, amount = 1) {
  const add = Math.max(0, Math.round(Number(amount) || 0));
  if (!add || !state?.materials) return 0;
  state.materials.molten_glass = (state.materials.molten_glass ?? 0) + add;
  return add;
}

/** Quest reward. Adds Dwarven Plans straight into materials (id `dwarven_plans`). */
export function grantDwarvenPlans(state, amount = 1) {
  const add = Math.max(0, Math.round(Number(amount) || 0));
  if (!add || !state?.materials) return 0;
  state.materials.dwarven_plans = (state.materials.dwarven_plans ?? 0) + add;
  return add;
}

/** Quest reward. Adds Ancient Plans straight into materials (id `ancient_plans`). */
export function grantAncientPlans(state, amount = 1) {
  const add = Math.max(0, Math.round(Number(amount) || 0));
  if (!add || !state?.materials) return 0;
  state.materials.ancient_plans = (state.materials.ancient_plans ?? 0) + add;
  return add;
}

export function placeOnDisplay(state, recipeId, displayIndex = state.selectedDisplay, slotIndex = 0) {
  if (chestCount(state, recipeId) < 1) return false;
  const display = state.displays[displayIndex];
  if (!display) return false;
  const kind = displayKind(displayIndex, state);
  if (kind === 'stand') return placeFromChest(state, recipeId, displayIndex);
  if (!canDisplayOn(kind, RECIPES[recipeId])) return false;
  if (!takeFromChest(state, recipeId)) return false;
  if (kind === 'shelf') {
    migrateShelfSlots(display, displayIndex, state);
    const slot = Math.min(SHELF_SLOT_COUNT - 1, Math.max(0, slotIndex ?? 0));
    const prev = display.shelfSlots[slot];
    if (prev) addToChest(state, prev);
    display.shelfSlots[slot] = recipeId;
    display.ware = { recipeId };
    display.slots = emptySlots();
    return true;
  }
  const prev = display.ware?.recipeId;
  if (prev) addToChest(state, prev);
  display.ware = { recipeId };
  display.slots = emptySlots();
  return true;
}

export function serializeState(state) {
  const furniture = cloneFurniture(state.furniture ?? defaultFurniture());
  return {
    version: SAVE_VERSION,
    gold: state.gold,
    materials: { ...state.materials },
    materialAcc: { ...(state.materialAcc ?? {}) },
    chest: { ...state.chest },
    chestLevel: state.chestLevel ?? 1,
    craftCounts: { ...state.craftCounts },
    mastery: Object.fromEntries(masteredIds(state).map((id) => [id, true])),
    selectedDisplay: state.selectedDisplay,
    expansions: [...(state.expansions ?? [])],
    furniture,
    fullscreen: Boolean(state.fullscreen),
    music: {
      volume: Number.isFinite(state.music?.volume) ? state.music.volume : DEFAULT_MUSIC_VOLUME,
      loop: Boolean(state.music?.loop),
      track: typeof state.music?.track === 'string' ? state.music.track : '',
    },
    shopXp: Math.max(0, Math.round(state.shopXp ?? 0)),
    shopLevel: shopProgress(state.shopXp ?? 0).level,
    skybox: skyboxId(state.skybox),
    brightness: clampBrightness(state.brightness),
    dungeonBrightness: clampDungeonBrightness(state.dungeonBrightness),
    photoMode: Boolean(state.photoMode),
    chefHat: Boolean(state.chefHat),
    appearance: normalizeAppearance(state.appearance),
    playTime: Math.max(0, Number(state.playTime) || 0),
    ...(typeof state.shopName === 'string' && state.shopName ? { shopName: state.shopName.slice(0, 32) } : {}),
    kingRoaldAt: Number.isFinite(state.kingRoaldAt) ? state.kingRoaldAt : scheduleKingRoald(Math.max(0, Number(state.playTime) || 0)),
    skills: state.skills?.toJSON?.() ?? createSkills().toJSON(),
    hq: savedHeroQuest(state),
    displays: state.displays.map((display, index) => ({
      ware: display.ware ? { recipeId: display.ware.recipeId } : null,
      furnitureId: display.furnitureId ?? null,
      slots: { ...emptySlots(), ...(display.slots ?? {}) },
      shelfSlots: displayKind(index, state) === 'shelf'
        ? [...emptyShelfSlots().map((_, slot) => display.shelfSlots?.[slot] ?? null)]
        : null,
      kind: display.kind ?? displayKind(index, state),
      name: display.name ?? SHOP.displays[index]?.name ?? null,
      bought: Boolean(display.bought),
      removed: Boolean(display.removed),
    })),
    boughtFurniture: {
      table: boughtFurnitureCount(state, 'table'),
      mannequin: boughtFurnitureCount(state, 'mannequin'),
      shelf: boughtFurnitureCount(state, 'shelf'),
      farming_patch: boughtFurnitureCount(state, 'farming_patch'),
    },
    freeFurnitureReplace: {
      table: Math.max(0, state.freeFurnitureReplace?.table ?? 0),
      mannequin: Math.max(0, state.freeFurnitureReplace?.mannequin ?? 0),
      farming_patch: Math.max(0, state.freeFurnitureReplace?.farming_patch ?? 0),
    },
  };
}

export function applyState(state, data) {
  if (!data || typeof data !== 'object') return false;
  const next = createState();
  if (typeof data.gold === 'number' && Number.isFinite(data.gold)) {
    next.gold = Math.max(0, Math.round(data.gold));
  }
  if (data.materials && typeof data.materials === 'object') {
    for (const id of Object.keys(next.materials)) {
      if (id === 'string') continue;
      const value = data.materials[id];
      if (typeof value === 'number' && Number.isFinite(value)) {
        next.materials[id] = Math.max(0, Math.round(value));
      }
    }
    migrateLegacyMetalBars(next, data);
    if (typeof data.materials.herbs === 'number' && Number.isFinite(data.materials.herbs)) {
      const extra = Math.max(0, Math.round(data.materials.herbs));
      if (data.materials.guam == null) next.materials.guam = extra;
      else next.materials.guam = (next.materials.guam ?? 0) + extra;
    }
    migrateGenericFish(next, data);
  }
  if (data.chest && typeof data.chest === 'object') {
    for (const [id, count] of Object.entries(data.chest)) {
      if (!RECIPES[id] || typeof count !== 'number' || !Number.isFinite(count)) continue;
      const n = Math.max(0, Math.round(count));
      if (n) next.chest[id] = n;
    }
  }
  if (data.craftCounts && typeof data.craftCounts === 'object') {
    for (const [id, count] of Object.entries(data.craftCounts)) {
      if (!RECIPES[id] || typeof count !== 'number' || !Number.isFinite(count)) continue;
      next.craftCounts[id] = Math.max(0, Math.round(count));
    }
  }
  let savedDisplays = Array.isArray(data.displays) ? data.displays : null;
  let savedFurnitureDisplays = Array.isArray(data.furniture?.displays) ? data.furniture.displays : null;
  if ((data.version ?? 0) < 6 && savedDisplays && savedDisplays.length >= OLD_DEFAULT_DISPLAYS) {
    savedDisplays = [
      ...savedDisplays.slice(0, OLD_DEFAULT_DISPLAYS),
      { kind: 'shelf', name: 'Back Wall Shelf', ware: null, shelfSlots: emptyShelfSlots() },
      ...savedDisplays.slice(OLD_DEFAULT_DISPLAYS),
    ];
    if (savedFurnitureDisplays) {
      savedFurnitureDisplays = [
        ...savedFurnitureDisplays.slice(0, OLD_DEFAULT_DISPLAYS),
        { x: 0, z: -3.11, rot: 0 },
        ...savedFurnitureDisplays.slice(OLD_DEFAULT_DISPLAYS),
      ];
    }
  }
  if (savedDisplays) {
    next.displays = SHOP.displays.map((spot, index) => (
      readSavedDisplay(savedDisplays[index], emptyDisplay(spot))
    ));
    for (let index = SHOP.displays.length; index < savedDisplays.length; index += 1) {
      const saved = savedDisplays[index];
      if (!saved || typeof saved !== 'object') continue;
      const kind = saved.kind === 'stand' ? 'stand' : saved.kind === 'shelf' ? 'shelf' : 'table';
      next.displays.push(readSavedDisplay(saved, emptyDisplay({
        kind,
        name: saved.name || (kind === 'stand' ? 'Mannequin' : kind === 'shelf' ? 'Shelf' : 'Table'),
        bought: true,
      })));
    }
  }
  next.boughtFurniture = emptyBoughtFurniture();
  next.freeFurnitureReplace = emptyFreeFurnitureReplace();
  if (data.freeFurnitureReplace && typeof data.freeFurnitureReplace === 'object') {
    for (const type of ['table', 'mannequin', 'farming_patch']) {
      const value = data.freeFurnitureReplace[type];
      const cap = type === 'farming_patch' ? FARMING_PATCH_CAP : FREE_FURNITURE_REPLACE;
      if (typeof value === 'number' && Number.isFinite(value)) {
        next.freeFurnitureReplace[type] = Math.max(0, Math.min(cap, Math.round(value)));
      }
    }
  }
  if (data.boughtFurniture && typeof data.boughtFurniture === 'object') {
    for (const type of ['table', 'mannequin', 'shelf', 'farming_patch']) {
      const value = data.boughtFurniture[type];
      if (typeof value === 'number' && Number.isFinite(value)) {
        next.boughtFurniture[type] = Math.max(0, Math.round(value));
      }
    }
  } else {
    for (let index = SHOP.displays.length; index < next.displays.length; index += 1) {
      const kind = next.displays[index].kind;
      const type = kind === 'stand' ? 'mannequin' : kind === 'shelf' ? 'shelf' : 'table';
      next.boughtFurniture[type] += 1;
    }
  }
  if (typeof data.selectedDisplay === 'number' && next.displays[data.selectedDisplay]) {
    next.selectedDisplay = data.selectedDisplay;
  }
  if (typeof data.chestLevel === 'number' && Number.isFinite(data.chestLevel)) {
    next.chestLevel = Math.min(CHEST_MAX_LEVEL, Math.max(1, Math.round(data.chestLevel)));
  }
  if (Array.isArray(data.expansions)) {
    next.expansions = data.expansions.filter((id) => padById(id));
  }
  if (data.materialAcc && typeof data.materialAcc === 'object') {
    for (const id of Object.keys(next.materialAcc)) {
      const value = data.materialAcc[id];
      if (typeof value === 'number' && Number.isFinite(value)) {
        next.materialAcc[id] = Math.max(0, value);
      }
    }
  }
  if (typeof data.fullscreen === 'boolean') {
    next.fullscreen = data.fullscreen;
  }
  if (data.music && typeof data.music === 'object') {
    const volume = data.music.volume;
    if (typeof volume === 'number' && Number.isFinite(volume)) {
      next.music.volume = Math.min(1, Math.max(0, volume));
    }
    if (typeof data.music.loop === 'boolean') next.music.loop = data.music.loop;
    if (typeof data.music.track === 'string') next.music.track = data.music.track;
  }
  if (typeof data.shopXp === 'number' && Number.isFinite(data.shopXp)) {
    next.shopXp = Math.max(0, Math.round(data.shopXp));
  }
  next.shopLevel = shopProgress(next.shopXp).level;
  next.skybox = skyboxId(data.skybox);
  next.brightness = data.brightness != null
    ? clampBrightness(data.brightness)
    : DEFAULT_BRIGHTNESS;
  next.dungeonBrightness = data.dungeonBrightness != null
    ? clampDungeonBrightness(data.dungeonBrightness)
    : DEFAULT_DUNGEON_BRIGHTNESS;
  next.photoMode = typeof data.photoMode === 'boolean' ? data.photoMode : false;
  if (typeof data.chefHat === 'boolean') next.chefHat = data.chefHat;
  next.appearance = normalizeAppearance(data.appearance);
  if (typeof data.playTime === 'number' && Number.isFinite(data.playTime)) {
    next.playTime = Math.max(0, data.playTime);
  }
  if (typeof data.shopName === 'string' && data.shopName.trim()) next.shopName = data.shopName.trim().slice(0, 32);
  if (typeof data.kingRoaldAt === 'number' && Number.isFinite(data.kingRoaldAt)) {
    next.kingRoaldAt = Math.max(0, data.kingRoaldAt);
  } else {
    next.kingRoaldAt = scheduleKingRoald(next.playTime);
  }
  if (data.furniture && typeof data.furniture === 'object') {
    const defaults = defaultFurniture();
    const readPose = (saved, fallback) => {
      if (!saved || typeof saved !== 'object') return { ...fallback };
      const x = typeof saved.x === 'number' && Number.isFinite(saved.x) ? saved.x : fallback.x;
      const z = typeof saved.z === 'number' && Number.isFinite(saved.z) ? saved.z : fallback.z;
      const rot = typeof saved.rot === 'number' && Number.isFinite(saved.rot) ? saved.rot : fallback.rot;
      return { x, z, rot };
    };
    const readPatch = (pose) => {
      const base = readPose(pose, { x: pose.x, z: pose.z, rot: FURNITURE_FORWARD });
      const paid = pose.paid === false ? false : true;
      let crop = null;
      if (
        pose.crop
        && typeof pose.crop.id === 'string'
        && Number.isFinite(pose.crop.startedAt)
        && Number.isFinite(pose.crop.endsAt)
      ) {
        crop = { id: pose.crop.id, startedAt: pose.crop.startedAt, endsAt: pose.crop.endsAt };
      }
      return { ...base, paid, crop };
    };
    next.furniture = {
      counter: readPose(data.furniture.counter, defaults.counter),
      anvil: readPose(data.furniture.anvil, defaults.anvil),
      chest: (() => {
        const pose = readPose(data.furniture.chest, defaults.chest);
        const oldStarterPads = [
          { x: 2.55, z: -2.22 },
          { x: 2.55, z: 3.05 },
        ];
        if (oldStarterPads.some((pad) => (
          Math.abs(pose.x - pad.x) < 1e-6 && Math.abs(pose.z - pad.z) < 1e-6
        ))) {
          return { x: defaults.chest.x, z: defaults.chest.z, rot: FURNITURE_FORWARD };
        }
        return pose;
      })(),
      range: data.furniture.range
        ? readPose(data.furniture.range, { ...SHOP.range, rot: FURNITURE_FORWARD })
        : null,
      cauldron: data.furniture.cauldron
        ? readPose(data.furniture.cauldron, { ...SHOP.cauldron, rot: FURNITURE_FORWARD })
        : null,
      furnace: data.furniture.furnace
        ? readPose(data.furniture.furnace, { ...SHOP.furnace, rot: FURNITURE_FORWARD })
        : null,
      wheel: data.furniture.wheel
        ? readPose(data.furniture.wheel, { ...SHOP.wheel, rot: FURNITURE_FORWARD })
        : null,
      loom: data.furniture.loom
        ? readPose(data.furniture.loom, { ...SHOP.loom, rot: FURNITURE_FORWARD })
        : null,
      fletch: data.furniture.fletch
        ? readPose(data.furniture.fletch, { ...SHOP.fletch, rot: FURNITURE_FORWARD })
        : null,
      potter: data.furniture.potter
        ? readPose(data.furniture.potter, { ...SHOP.potter, rot: FURNITURE_FORWARD })
        : null,
      sawmill: data.furniture.sawmill
        ? readPose(data.furniture.sawmill, { ...SHOP.sawmill, rot: FURNITURE_FORWARD })
        : null,
      portal: data.furniture.portal
        ? readPose(data.furniture.portal, { x: 0, z: 0, rot: FURNITURE_FORWARD })
        : null,
      rug: readPose(data.furniture.rug, defaults.rug),
      patches: Array.isArray(data.furniture.patches)
        ? data.furniture.patches.filter((pose) => (
          pose && typeof pose.x === 'number' && typeof pose.z === 'number'
        )).slice(0, FARMING_PATCH_CAP).map((pose) => readPatch(pose))
        : [],
      placed: readPlacedFurniture(data.furniture.placed),
      displays: migrateStarterMannequins(next.displays.map((display, index) => {
        const fallback = defaults.displays[index] ?? {
          x: 0,
          z: 0.8,
          rot: FURNITURE_FORWARD,
        };
        const pose = readPose(savedFurnitureDisplays?.[index] ?? data.furniture.displays?.[index], fallback);
        if ((display.kind ?? SHOP.displays[index]?.kind) === 'shelf') {
          return snapToWallGrid(pose.x, pose.z, next.expansions ?? [], pose.rot);
        }
        return pose;
      })),
    };
  }
  while ((next.furniture.displays?.length ?? 0) < next.displays.length) {
    next.furniture.displays.push({ x: 0, z: 0.8, rot: FURNITURE_FORWARD });
  }
  if (!Array.isArray(next.furniture.patches)) next.furniture.patches = [];
  if (!Array.isArray(next.furniture.placed)) next.furniture.placed = [];
  next.boughtFurniture.farming_patch = Math.max(
    next.boughtFurniture.farming_patch ?? 0,
    next.furniture.patches.length,
  );
  for (const [id, count] of Object.entries(retiredRefund(data?.furniture?.placed))) {
    next.materials[id] = (next.materials[id] ?? 0) + count;
  }
  state.gold = next.gold;
  state.materials = next.materials;
  state.materialAcc = next.materialAcc;
  state.chest = next.chest;
  state.chestLevel = next.chestLevel;
  state.craftCounts = next.craftCounts;
  state.crafts = {};
  state.displays = next.displays;
  state.furniture = next.furniture;
  state.expansions = next.expansions;
  state.selectedDisplay = next.selectedDisplay;
  state.fullscreen = next.fullscreen;
  state.music = next.music;
  state.boughtFurniture = next.boughtFurniture;
  state.freeFurnitureReplace = next.freeFurnitureReplace;
  state.shopXp = next.shopXp;
  state.shopLevel = next.shopLevel;
  state.skybox = next.skybox;
  state.brightness = next.brightness;
  state.dungeonBrightness = next.dungeonBrightness;
  state.photoMode = next.photoMode;
  state.chefHat = next.chefHat;
  state.appearance = next.appearance;
  state.playTime = next.playTime;
  state.shopName = next.shopName;
  state.kingRoaldAt = next.kingRoaldAt;
  state.ready = [];
  claimLoadedDisplays(state);
  refreshShowcases(state);
  if ((state.expansions ?? []).includes('back')) clearBackWallShelf(state);
  if (!state.skills?.fromJSON) state.skills = createSkills();
  if (data.skills && typeof data.skills === 'object') {
    state.skills.fromJSON(data.skills);
  } else {
    state.skills.fromJSON(skillCatchUp(next));
    const earned = state.skills.list()
      .filter((row) => row.level > 1)
      .map((row) => `${row.name} ${row.level}`);
    pushLog(state, earned.length
      ? `Skills have arrived! Your past work earned you: ${earned.join(', ')}.`
      : 'Skills have arrived! Every skill starts at level 1.');
  }
  catchUpRaisedFishLevels(state, data);
  state.hq = normalizeHeroQuestState(data.hq, Date.now());
  repairFarmingPatches(state);
  return true;
}

/** Heroes and quests ride along in every save, including Net's autosave. */
function savedHeroQuest(state, now = Date.now()) {
  const hq = normalizeHeroQuestState(state?.hq, now);
  hq.lastSeenAt = now;
  if (state) state.hq = hq;
  return hq;
}

/**
 * Paid patches with a lawn pose stay, so a reload draws them.
 * A pose with nowhere to draw (or a buy that never stored a pose) becomes
 * one free re-place. Cancel never reaches this — it does not charge.
 */
export function repairFarmingPatches(state) {
  if (!state) return { kept: 0, credited: 0 };
  if (!state.furniture) state.furniture = defaultFurniture();
  if (!Array.isArray(state.furniture.patches)) state.furniture.patches = [];
  const expansions = state.expansions ?? [];
  const kept = [];
  for (const pose of state.furniture.patches) {
    if (farmingPatchPoseKept(pose, expansions)) kept.push(pose);
  }
  state.furniture.patches = kept.slice(0, FARMING_PATCH_CAP);
  if (!state.boughtFurniture) state.boughtFurniture = emptyBoughtFurniture();
  const bought = boughtFurnitureCount(state, 'farming_patch');
  const room = Math.max(0, FARMING_PATCH_CAP - state.furniture.patches.length);
  const unplaced = Math.max(0, bought - state.furniture.patches.length);
  if (!state.freeFurnitureReplace) state.freeFurnitureReplace = emptyFreeFurnitureReplace();
  state.freeFurnitureReplace.farming_patch = Math.min(room, unplaced);
  return {
    kept: state.furniture.patches.length,
    credited: state.freeFurnitureReplace.farming_patch,
  };
}

export function autoStock(state) {
  refreshShowcases(state);
}

function clearMannequinHandsAndFeet(state, display) {
  if (!display.slots) display.slots = emptySlots();
  for (const slot of ['boots', 'gloves']) {
    const id = display.slots[slot];
    if (!id) continue;
    display.slots[slot] = null;
    if (RECIPES[id] && chestCount(state, id) < 1) addToChest(state, id);
  }
  if (isHandOrFootWare(display.ware?.recipeId)) {
    const filled = ARMOUR_SLOTS.map((slot) => display.slots[slot]).filter(Boolean);
    display.ware = filled.length ? { recipeId: filled[0] } : null;
  }
}

export function assignStandPiece(state, displayIndex, recipeId) {
  if (chestCount(state, recipeId) < 1) return false;
  const display = state.displays[displayIndex];
  if (!display || displayKind(displayIndex, state) !== 'stand') return false;
  const recipe = RECIPES[recipeId];
  if (isHandOrFootWare(recipe)) return false;
  if (recipe?.category !== 'armour' || !ARMOUR_SLOTS.includes(recipe.slot)) return false;
  if (!display.slots) display.slots = emptySlots();
  display.slots[recipe.slot] = recipeId;
  display.ware = { recipeId };
  return true;
}

export function fillStandFromRecipe(state, displayIndex, recipeId) {
  if (chestCount(state, recipeId) < 1) return false;
  const display = state.displays[displayIndex];
  if (!display || displayKind(displayIndex, state) !== 'stand') return false;
  const recipe = RECIPES[recipeId];
  if (recipe?.category !== 'armour' || isHandOrFootWare(recipe)) return false;
  if (!display.slots) display.slots = emptySlots();
  const owned = Object.keys(state.chest).filter((id) => chestCount(state, id) > 0);
  fillStandSet(display, recipeId, owned);
  return Boolean(display.ware);
}

export function placeFromChest(state, recipeId, displayIndex = state.selectedDisplay, slotIndex = 0) {
  if (chestCount(state, recipeId) < 1) return false;
  const display = state.displays[displayIndex];
  if (!display) return false;
  if (!display.slots) display.slots = emptySlots();
  const recipe = RECIPES[recipeId];
  if (displayKind(displayIndex, state) === 'stand' && recipe?.noMannequin) return false;
  if (displayKind(displayIndex, state) === 'stand' && recipe?.category === 'armour') {
    return fillStandFromRecipe(state, displayIndex, recipeId);
  }
  if (displayKind(displayIndex, state) === 'stand') {
    display.ware = { recipeId };
    display.slots = emptySlots();
    return true;
  }
  return placeOnDisplay(state, recipeId, displayIndex, slotIndex);
}

export function stockSelected(state, recipeId) {
  if (!recipeId) {
    recipeId = Object.keys(state.chest).find((id) => state.chest[id] > 0);
    if (!recipeId) return false;
  }
  return placeFromChest(state, recipeId, state.selectedDisplay);
}

function chestReadyIds(state) {
  return Object.entries(state.chest)
    .filter(([, count]) => count > 0)
    .flatMap(([id, count]) => Array(count).fill(id));
}

export function canRestock(state, materialId) {
  const mat = MATERIALS[materialId];
  if (!mat || isCraftedMaterial(materialId) || mat.quest || !mat.restock || mat.restock <= 0) return false;
  if (materialIsFull(state, materialId)) return false;
  return state.gold >= mat.restock;
}

export function restock(state, materialId) {
  const mat = MATERIALS[materialId];
  if (!canRestock(state, materialId)) return false;
  state.gold -= mat.restock;
  if (grantMaterial(state, materialId, 1) <= 0) {
    state.gold += mat.restock;
    return false;
  }
  return true;
}

export function removeWare(state, displayIndex) {
  const display = state.displays[displayIndex];
  if (!display?.ware) return null;
  const recipeId = display.ware.recipeId;
  if (chestCount(state, recipeId) > 0) {
    takeStock(state, recipeId);
  } else {
    display.ware = null;
    refreshShowcases(state);
  }
  return recipeId;
}

export function sellFromDisplay(state, displayIndex) {
  const recipeId = state.displays[displayIndex]?.ware?.recipeId;
  if (!recipeId) return 0;
  return sellToCustomer(state, recipeId, RECIPES[recipeId].price);
}

export function sellToCustomer(state, recipeId, gold = RECIPES[recipeId]?.price ?? 0) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return 0;
  if (!takeStock(state, recipeId)) return 0;
  state.gold += gold;
  return gold;
}

export function buyFromCustomer(state, materialId, price) {
  const mat = MATERIALS[materialId];
  if (!mat || isCraftedMaterial(materialId) || mat.quest || price < 0 || state.gold < price) return false;
  if (materialIsFull(state, materialId)) return false;
  state.gold -= price;
  if (grantMaterial(state, materialId, 1) <= 0) {
    state.gold += price;
    return false;
  }
  return true;
}

export function collectSale(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return 0;
  state.gold += recipe.price;
  return recipe.price;
}

export function displayedWares(state) {
  return state.displays.flatMap((d, index) => {
    const items = [];
    if (d.ware) items.push({ index, recipeId: d.ware.recipeId });
    for (const recipeId of d.shelfSlots ?? []) {
      if (recipeId && recipeId !== d.ware?.recipeId) items.push({ index, recipeId });
    }
    return items;
  });
}

export function pushLog(state, text) {
  state.log.unshift(text);
  state.log = state.log.slice(0, 5);
}

/** Ambient traveler lines. They stay in state.log; the bottom box does not draw them. */
export function isCustomerActivityLog(text) {
  return / looks around for | grows tired and leaves\.| arrives, seeking /.test(String(text ?? ''));
}

/** File, cheat, and browser notices. Gathering, crafting, sales, and level-ups stay. */
export function isSystemLog(text) {
  return /^(Shop (saved to|loaded from) a file|Could not (save that|read that save) file|Rune Craft is open|Cleared uploaded models|Fullscreen is not available|Cheat applied)/.test(String(text ?? ''));
}

export function visibleLog(state) {
  return (state?.log ?? []).filter((line) => !isCustomerActivityLog(line) && !isSystemLog(line));
}

export function decidePurchase(customerId, wares, rng = Math.random) {
  const customer = CUSTOMERS[customerId];
  const preferred = wares.filter((w) => customer.prefers.includes(w.recipeId));
  if (preferred.length) {
    const pick = preferred[Math.floor(rng() * preferred.length)];
    return { action: 'buy', displayIndex: pick.index, recipeId: pick.recipeId };
  }
  if (wares.length === 0) {
    if (customer.leaveIfEmpty) return { action: 'leave' };
    if (customer.patient) return { action: 'wait' };
    return { action: 'leave' };
  }
  if (customer.patient) return { action: 'wait' };
  if (rng() < OTHER_CHANCE) {
    const pick = wares[Math.floor(rng() * wares.length)];
    return { action: 'buy', displayIndex: pick.index, recipeId: pick.recipeId };
  }
  return { action: 'leave' };
}

export function decideAfterWait(customerId, wares, rng = Math.random) {
  const customer = CUSTOMERS[customerId];
  const preferred = wares.filter((w) => customer.prefers.includes(w.recipeId));
  if (preferred.length) {
    const pick = preferred[Math.floor(rng() * preferred.length)];
    return { action: 'buy', displayIndex: pick.index, recipeId: pick.recipeId };
  }
  if (wares.length && rng() < OTHER_CHANCE) {
    const pick = wares[Math.floor(rng() * wares.length)];
    return { action: 'buy', displayIndex: pick.index, recipeId: pick.recipeId };
  }
  if (customer.patient && wares.length === 0) return { action: 'wait' };
  return { action: 'leave' };
}
