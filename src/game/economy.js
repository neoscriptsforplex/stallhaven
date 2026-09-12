import {
  ARMOUR_SLOTS,
  CUSTOMERS,
  DEFAULT_SKYBOX,
  MATERIALS,
  METALS,
  OTHER_CHANCE,
  RECIPES,
  isCraftedMaterial,
  isMaterialCraft,
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
  matchingArmourIds,
  masteryNeed,
  MASTERY_SPEED,
  normalizeAppearance,
  offerClassLabel,
  offerClassOf,
  recipeCost,
  recipeList,
  scheduleKingRoald,
} from './catalog.js';
import {
  CAULDRON_COST,
  WHEEL_COST,
  STATION_UNLOCKS,
  CHEST_MAX_LEVEL,
  FURNITURE_FORWARD,
  MATERIAL_CAP,
  SWAP_PRICE_RATIO,
  chestSlots,
  chestUpgradeCost,
  cloneFurniture,
  defaultFurniture,
  emptyMaterialAcc,
  expansionCost,
  MAX_EXPANSIONS,
  furnitureBuyCost,
  furnitureKindForType,
  furnitureLabelForType,
  furnaceBesideAnvil,
  padById,
  padConnects,
} from './layout.js';

export {
  CAULDRON_COST,
  WHEEL_COST,
  STATION_UNLOCKS,
  furnitureBuyCost,
  masteryNeed,
  MASTERY_SPEED,
  formatGold,
  SHOP_MAX_LEVEL,
  DEFAULT_SKYBOX,
  SKYBOXES,
};

export const SAVE_VERSION = 9;
export const OLD_DEFAULT_DISPLAYS = 8;
export const DEFAULT_MUSIC_VOLUME = 0.75;

function emptyBoughtFurniture() {
  return { table: 0, mannequin: 0 };
}

/** Old saves used ores for smithing. Copy ore counts onto bars so progress is not bricked. */
function migrateLegacyMetalBars(next, data) {
  const version = data.version ?? 0;
  if (version >= SAVE_VERSION) return;
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
    state.gold = (state.gold ?? 0) + 10000;
    return 'motherlode';
  }
  if (code === 'freshstart') {
    const next = createState();
    for (const key of Object.keys(next)) {
      state[key] = next[key];
    }
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
    return 'maxcape';
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
    music: { volume: DEFAULT_MUSIC_VOLUME },
    boughtFurniture: emptyBoughtFurniture(),
    shopXp: 0,
    shopLevel: 1,
    skybox: DEFAULT_SKYBOX,
    chefHat: false,
    appearance: defaultAppearance(),
    playTime: 0,
    kingRoaldAt: scheduleKingRoald(0),
    log: [],
  };
}

export function craftCount(state, recipeId) {
  return state.craftCounts?.[recipeId] ?? 0;
}

export function unlockRemaining(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe?.previousId) return 0;
  return Math.max(0, (recipe.unlockNeed ?? 0) - craftCount(state, recipe.previousId));
}

export function chestCapacity(state) {
  return chestSlots(state.chestLevel ?? 1);
}

export function chestHasSpace(state, extra = 1) {
  return chestTotal(state) + extra <= chestCapacity(state);
}

export function isUnlocked(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return false;
  if (recipe.category === 'potion' && !ownsCauldron(state)) return false;
  if (recipe.category === 'smelt' && !ownsFurnace(state)) return false;
  if (recipe.category === 'spin' && !ownsWheel(state)) return false;
  if (!recipe.previousId) return true;
  return craftCount(state, recipe.previousId) >= (recipe.unlockNeed ?? 0);
}

export function craftBlockReason(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return 'Unknown recipe.';
  if (recipe.category === 'potion' && !ownsCauldron(state)) {
    return 'Place a cauldron from Upgrade to brew potions.';
  }
  if (recipe.category === 'smelt' && !ownsFurnace(state)) {
    return 'The furnace is missing.';
  }
  if (recipe.category === 'spin' && !ownsWheel(state)) {
    return 'Place a spinning wheel from Upgrade to spin flax into bow string.';
  }
  if (!isUnlocked(state, recipeId)) {
    const remain = unlockRemaining(state, recipeId);
    const prev = recipe.previousId ? RECIPES[recipe.previousId] : null;
    return `Locked. Craft ${remain} more ${prev?.name ?? 'item'} first.`;
  }
  if (state.crafts[recipeId]) return `${recipe.name} is already in progress.`;
  if (!isMaterialCraft(recipe) && !chestHasSpace(state)) return 'The chest is full.';
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

export function startCraft(state, recipeId, nowSeconds) {
  const recipe = RECIPES[recipeId];
  if (!canCraft(state, recipeId)) return false;
  const cost = recipeCost(recipe);
  state.gold -= cost.gold || 0;
  for (const [materialId, need] of Object.entries(cost.materials)) {
    state.materials[materialId] -= need;
  }
  state.crafts[recipeId] = { startedAt: nowSeconds, duration: craftDuration(state, recipeId) };
  return true;
}

export function craftProgress(state, recipeId, nowSeconds) {
  const craft = state.crafts[recipeId];
  if (!craft) return null;
  const elapsed = nowSeconds - craft.startedAt;
  const left = Math.max(0, craft.duration - elapsed);
  return { left, duration: craft.duration, t: Math.min(1, elapsed / craft.duration) };
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

export function addToChest(state, recipeId) {
  if (!RECIPES[recipeId]) return false;
  state.chest[recipeId] = chestCount(state, recipeId) + 1;
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
  const display = state.displays[index];
  if (!display || display.removed) return false;
  const ids = [];
  if (Array.isArray(display.shelfSlots)) {
    for (const id of display.shelfSlots) {
      if (id) ids.push(id);
    }
  } else if (display.ware?.recipeId) {
    ids.push(display.ware.recipeId);
  }
  for (const id of ids) addToChest(state, id);
  display.ware = null;
  display.slots = emptySlots();
  display.shelfSlots = emptyShelfSlots();
  display.removed = true;
  return true;
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
  const cost = expansionCost((state.expansions ?? []).length);
  state.gold -= cost;
  state.expansions = [...(state.expansions ?? []), padId];
  if (padId === 'back') clearBackWallShelf(state);
  return true;
}

export function stationCost(id) {
  return STATION_UNLOCKS.find((item) => item.id === id)?.cost ?? 0;
}

export function ownsStation(state, id) {
  return Boolean(state.furniture?.[id]);
}

export function canBuyStation(state, id) {
  const cost = stationCost(id);
  return cost > 0 && !ownsStation(state, id) && state.gold >= cost;
}

export function buyStation(state, id, pose) {
  const cost = stationCost(id);
  if (cost <= 0 || state.gold < cost || !pose || ownsStation(state, id)) return false;
  state.gold -= cost;
  state.furniture[id] = {
    x: pose.x,
    z: pose.z,
    rot: pose.rot ?? FURNITURE_FORWARD,
  };
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

export function canBuyFurnace(state) {
  return canBuyStation(state, 'furnace');
}

export function buyFurnace(state, pose) {
  return buyStation(state, 'furnace', pose);
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

export function nextFurnitureCost(state, type) {
  return furnitureBuyCost(boughtFurnitureCount(state, type));
}

export function canBuyFurniture(state, type) {
  if (type !== 'table' && type !== 'mannequin') return false;
  return state.gold >= nextFurnitureCost(state, type);
}

export function furnitureNeedGold(state, type) {
  const cost = nextFurnitureCost(state, type);
  const have = state.gold ?? 0;
  if (have >= cost) return '';
  const label = furnitureLabelForType(type).toLowerCase();
  return `Need ${formatGold(cost)}g to buy a ${label}. You have ${formatGold(have)}g.`;
}

export function buyFurniture(state, type, pose) {
  if (!canBuyFurniture(state, type) || !pose) return false;
  const kind = furnitureKindForType(type);
  const cost = nextFurnitureCost(state, type);
  state.gold -= cost;
  if (!state.boughtFurniture) state.boughtFurniture = emptyBoughtFurniture();
  state.boughtFurniture[type] = boughtFurnitureCount(state, type) + 1;
  const n = state.boughtFurniture[type];
  const label = furnitureLabelForType(type);
  state.displays.push(emptyDisplay({
    kind,
    name: `${label} ${n}`,
    bought: true,
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
    if (cur >= MATERIAL_CAP) {
      state.materialAcc[mat.id] = 0;
      continue;
    }
    state.materialAcc[mat.id] = (state.materialAcc[mat.id] ?? 0) + dt / every;
    const add = Math.floor(state.materialAcc[mat.id]);
    if (add <= 0) continue;
    state.materialAcc[mat.id] -= add;
    state.materials[mat.id] = Math.min(MATERIAL_CAP, cur + add);
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

export function completeCrafts(state, nowSeconds) {
  const finished = [];
  for (const [recipeId, craft] of Object.entries(state.crafts)) {
    if (nowSeconds - craft.startedAt >= craft.duration) {
      delete state.crafts[recipeId];
      const recipe = RECIPES[recipeId];
      if (isMaterialCraft(recipe) && MATERIALS[recipe.outputMaterial]) {
        const n = recipe.outputCount ?? 1;
        state.materials[recipe.outputMaterial] = (state.materials[recipe.outputMaterial] ?? 0) + n;
      } else {
        addToChest(state, recipeId);
      }
      if (!state.craftCounts) state.craftCounts = {};
      state.craftCounts[recipeId] = craftCount(state, recipeId) + 1;
      grantShopXp(state, recipeId);
      finished.push(recipeId);
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
      for (const slot of ARMOUR_SLOTS) {
        const id = display.slots[slot];
        if (id && chestCount(state, id) < 1) display.slots[slot] = null;
      }
      const focus = display.ware?.recipeId;
      if (focus && chestCount(state, focus) > 0 && RECIPES[focus]?.category === 'armour') {
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
    const next = chestIds.find((id) => !shown.has(id) && RECIPES[id]?.category === 'armour');
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

export function placeOnDisplay(state, recipeId, displayIndex = state.selectedDisplay, slotIndex = 0) {
  if (chestCount(state, recipeId) < 1) return false;
  const display = state.displays[displayIndex];
  if (!display) return false;
  const kind = displayKind(displayIndex, state);
  if (kind === 'stand') return placeFromChest(state, recipeId, displayIndex);
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
    music: { volume: Number.isFinite(state.music?.volume) ? state.music.volume : DEFAULT_MUSIC_VOLUME },
    shopXp: Math.max(0, Math.round(state.shopXp ?? 0)),
    shopLevel: shopProgress(state.shopXp ?? 0).level,
    skybox: skyboxId(state.skybox),
    chefHat: Boolean(state.chefHat),
    appearance: normalizeAppearance(state.appearance),
    playTime: Math.max(0, Number(state.playTime) || 0),
    kingRoaldAt: Number.isFinite(state.kingRoaldAt) ? state.kingRoaldAt : scheduleKingRoald(Math.max(0, Number(state.playTime) || 0)),
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
        { x: 0, z: -3.22, rot: 0 },
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
  if (data.boughtFurniture && typeof data.boughtFurniture === 'object') {
    for (const type of ['table', 'mannequin']) {
      const value = data.boughtFurniture[type];
      if (typeof value === 'number' && Number.isFinite(value)) {
        next.boughtFurniture[type] = Math.max(0, Math.round(value));
      }
    }
  } else {
    for (let index = SHOP.displays.length; index < next.displays.length; index += 1) {
      const type = next.displays[index].kind === 'stand' ? 'mannequin' : 'table';
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
  }
  if (typeof data.shopXp === 'number' && Number.isFinite(data.shopXp)) {
    next.shopXp = Math.max(0, Math.round(data.shopXp));
  }
  next.shopLevel = shopProgress(next.shopXp).level;
  next.skybox = skyboxId(data.skybox);
  if (typeof data.chefHat === 'boolean') next.chefHat = data.chefHat;
  next.appearance = normalizeAppearance(data.appearance);
  if (typeof data.playTime === 'number' && Number.isFinite(data.playTime)) {
    next.playTime = Math.max(0, data.playTime);
  }
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
    next.furniture = {
      counter: readPose(data.furniture.counter, defaults.counter),
      anvil: readPose(data.furniture.anvil, defaults.anvil),
      chest: readPose(data.furniture.chest, defaults.chest),
      range: readPose(data.furniture.range, defaults.range),
      cauldron: data.furniture.cauldron
        ? readPose(data.furniture.cauldron, SHOP.cauldron)
        : null,
      furnace: data.furniture.furnace
        ? readPose(data.furniture.furnace, SHOP.furnace)
        : furnaceBesideAnvil(readPose(data.furniture.anvil, defaults.anvil)),
      wheel: data.furniture.wheel
        ? readPose(data.furniture.wheel, SHOP.wheel)
        : null,
      displays: next.displays.map((display, index) => {
        const fallback = defaults.displays[index] ?? {
          x: 0,
          z: 0.8,
          rot: FURNITURE_FORWARD,
        };
        return readPose(savedFurnitureDisplays?.[index] ?? data.furniture.displays?.[index], fallback);
      }),
    };
  }
  while ((next.furniture.displays?.length ?? 0) < next.displays.length) {
    next.furniture.displays.push({ x: 0, z: 0.8, rot: FURNITURE_FORWARD });
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
  state.shopXp = next.shopXp;
  state.shopLevel = next.shopLevel;
  state.skybox = next.skybox;
  state.chefHat = next.chefHat;
  state.appearance = next.appearance;
  state.playTime = next.playTime;
  state.kingRoaldAt = next.kingRoaldAt;
  state.ready = [];
  claimLoadedDisplays(state);
  refreshShowcases(state);
  if ((state.expansions ?? []).includes('back')) clearBackWallShelf(state);
  return true;
}

export function autoStock(state) {
  refreshShowcases(state);
}

export function assignStandPiece(state, displayIndex, recipeId) {
  if (chestCount(state, recipeId) < 1) return false;
  const display = state.displays[displayIndex];
  if (!display || displayKind(displayIndex, state) !== 'stand') return false;
  const recipe = RECIPES[recipeId];
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
  if (recipe?.category !== 'armour') return false;
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
  if (!mat || isCraftedMaterial(materialId) || !mat.restock || mat.restock <= 0) return false;
  return state.gold >= mat.restock;
}

export function restock(state, materialId) {
  const mat = MATERIALS[materialId];
  if (!canRestock(state, materialId)) return false;
  state.gold -= mat.restock;
  state.materials[materialId] += 1;
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
  if (!mat || isCraftedMaterial(materialId) || price < 0 || state.gold < price) return false;
  state.gold -= price;
  state.materials[materialId] += 1;
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
