import {
  ARMOUR_SLOTS,
  CUSTOMERS,
  MATERIALS,
  OTHER_CHANCE,
  RECIPES,
  SHOP,
  START_GOLD,
  displayKind,
  emptySlots,
  matchingArmourIds,
  recipeCost,
  recipeList,
} from './catalog.js';
import {
  CHEST_MAX_LEVEL,
  MATERIAL_CAP,
  SWAP_PRICE_RATIO,
  chestSlots,
  chestUpgradeCost,
  cloneFurniture,
  defaultFurniture,
  emptyMaterialAcc,
  expansionCost,
  padById,
  padConnects,
} from './layout.js';

export const SAVE_VERSION = 2;

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
    displays: SHOP.displays.map(() => ({
      ware: null,
      furnitureId: null,
      slots: emptySlots(),
    })),
    furniture: defaultFurniture(),
    expansions: [],
    selectedDisplay: 0,
    wareLooks: {},
    log: [],
  };
}

export function craftCount(state, recipeId) {
  return state.craftCounts?.[recipeId] ?? 0;
}

export function isUnlocked(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return false;
  if (!recipe.previousId) return true;
  return craftCount(state, recipe.previousId) >= (recipe.unlockNeed ?? 0);
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

export function canCraft(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return false;
  if (!isUnlocked(state, recipeId)) return false;
  if (state.crafts[recipeId]) return false;
  if (!chestHasSpace(state)) return false;
  const cost = recipeCost(recipe);
  if ((cost.gold || 0) > state.gold) return false;
  for (const [materialId, need] of Object.entries(cost.materials)) {
    if ((state.materials[materialId] ?? 0) < need) return false;
  }
  return true;
}

export function startCraft(state, recipeId, nowSeconds) {
  const recipe = RECIPES[recipeId];
  if (!canCraft(state, recipeId)) return false;
  const cost = recipeCost(recipe);
  state.gold -= cost.gold || 0;
  for (const [materialId, need] of Object.entries(cost.materials)) {
    state.materials[materialId] -= need;
  }
  state.crafts[recipeId] = { startedAt: nowSeconds, duration: recipe.time };
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
  if (!padConnects(pad, state.expansions ?? [])) return false;
  return state.gold >= expansionCost((state.expansions ?? []).length);
}

export function buyExpansion(state, padId) {
  if (!canBuyExpansion(state, padId)) return false;
  const cost = expansionCost((state.expansions ?? []).length);
  state.gold -= cost;
  state.expansions = [...(state.expansions ?? []), padId];
  return true;
}

export function swapOffer(state, customerId, requestRecipeId) {
  const customer = CUSTOMERS[customerId];
  if (!customer) return null;
  const owned = recipeList().filter((recipe) => (
    recipe.id !== requestRecipeId && hasStock(state, recipe.id)
  ));
  const preferred = owned.filter((recipe) => customer.prefers.includes(recipe.id));
  const sameClass = owned.filter((recipe) => (
    customer.combatClass && recipe.combatClass === customer.combatClass
  ));
  const pool = preferred.length ? preferred : sameClass;
  if (!pool.length) return null;
  const want = RECIPES[requestRecipeId];
  pool.sort((a, b) => {
    const da = Math.abs((a.price ?? 0) - (want?.price ?? 0));
    const db = Math.abs((b.price ?? 0) - (want?.price ?? 0));
    return da - db;
  });
  const recipe = pool[0];
  const gold = Math.max(1, Math.round(recipe.price * SWAP_PRICE_RATIO));
  return { recipeId: recipe.id, gold, listPrice: recipe.price };
}

export function tickMaterials(state, dt) {
  // Quests will later change how better materials are earned.
  if (!state.materialAcc) state.materialAcc = emptyMaterialAcc(state.materials);
  for (const mat of Object.values(MATERIALS)) {
    const every = mat.regenEvery;
    if (!every || every <= 0) continue;
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
  if (display.ware?.recipeId === recipeId) display.ware = null;
  refreshShowcases(state);
  return true;
}

export function completeCrafts(state, nowSeconds) {
  const finished = [];
  for (const [recipeId, craft] of Object.entries(state.crafts)) {
    if (nowSeconds - craft.startedAt >= craft.duration) {
      delete state.crafts[recipeId];
      addToChest(state, recipeId);
      if (!state.craftCounts) state.craftCounts = {};
      state.craftCounts[recipeId] = craftCount(state, recipeId) + 1;
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
  }
  return shown;
}

function fillStandSet(display, recipeId, ownedIds) {
  display.slots = matchingArmourIds(recipeId, ownedIds);
  const filled = ARMOUR_SLOTS.map((slot) => display.slots[slot]).filter(Boolean);
  display.ware = filled.length ? { recipeId: filled.includes(recipeId) ? recipeId : filled[0] } : null;
}

export function refreshShowcases(state) {
  for (const [index, display] of state.displays.entries()) {
    if (!display.slots) display.slots = emptySlots();
    const kind = displayKind(index);
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
    } else if (display.ware && chestCount(state, display.ware.recipeId) < 1) {
      display.ware = null;
      display.slots = emptySlots();
    }
  }

  const shown = shownIds(state);
  const chestIds = Object.keys(state.chest).filter((id) => state.chest[id] > 0);

  for (const [index, display] of state.displays.entries()) {
    if (displayKind(index) !== 'stand') continue;
    if (ARMOUR_SLOTS.some((slot) => display.slots[slot])) continue;
    const next = chestIds.find((id) => !shown.has(id) && RECIPES[id]?.category === 'armour');
    if (!next) continue;
    fillStandSet(display, next, chestIds);
    for (const slot of ARMOUR_SLOTS) {
      if (display.slots[slot]) shown.add(display.slots[slot]);
    }
  }

  for (const [index, display] of state.displays.entries()) {
    if (displayKind(index) !== 'shelf' || display.ware) continue;
    const next = chestIds.find((id) => !shown.has(id) && (RECIPES[id]?.shelfItem || RECIPES[id]?.category === 'food'));
    if (!next) continue;
    display.ware = { recipeId: next };
    shown.add(next);
  }

  for (const [index, display] of state.displays.entries()) {
    if (displayKind(index) === 'stand') continue;
    if (display.ware) continue;
    const next = chestIds.find((id) => !shown.has(id) && RECIPES[id]?.category !== 'food')
      ?? chestIds.find((id) => !shown.has(id));
    if (!next) continue;
    display.ware = { recipeId: next };
    shown.add(next);
  }
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
    selectedDisplay: state.selectedDisplay,
    expansions: [...(state.expansions ?? [])],
    furniture,
    displays: state.displays.map((display) => ({
      ware: display.ware ? { recipeId: display.ware.recipeId } : null,
      furnitureId: display.furnitureId ?? null,
      slots: { ...emptySlots(), ...(display.slots ?? {}) },
    })),
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
      const value = data.materials[id];
      if (typeof value === 'number' && Number.isFinite(value)) {
        next.materials[id] = Math.max(0, Math.round(value));
      }
    }
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
  if (Array.isArray(data.displays)) {
    next.displays = next.displays.map((display, index) => {
      const saved = data.displays[index];
      if (!saved || typeof saved !== 'object') return display;
      const wareId = saved.ware?.recipeId;
      const slots = emptySlots();
      if (saved.slots && typeof saved.slots === 'object') {
        for (const slot of ARMOUR_SLOTS) {
          const id = saved.slots[slot];
          slots[slot] = RECIPES[id] ? id : null;
        }
      }
      return {
        ware: RECIPES[wareId] ? { recipeId: wareId } : null,
        furnitureId: saved.furnitureId ?? null,
        slots,
      };
    });
  }
  if (typeof data.selectedDisplay === 'number' && SHOP.displays[data.selectedDisplay]) {
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
      displays: defaults.displays.map((pose, index) => readPose(data.furniture.displays?.[index], pose)),
    };
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
  state.ready = [];
  refreshShowcases(state);
  return true;
}

export function autoStock(state) {
  refreshShowcases(state);
}

export function placeFromChest(state, recipeId, displayIndex = state.selectedDisplay) {
  if (chestCount(state, recipeId) < 1) return false;
  const display = state.displays[displayIndex];
  if (!display) return false;
  if (!display.slots) display.slots = emptySlots();
  const recipe = RECIPES[recipeId];
  if (displayKind(displayIndex) === 'stand' && recipe?.category === 'armour') {
    const owned = Object.keys(state.chest).filter((id) => chestCount(state, id) > 0);
    fillStandSet(display, recipeId, owned);
    return true;
  }
  display.ware = { recipeId };
  display.slots = emptySlots();
  return true;
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
  return Boolean(mat) && state.gold >= mat.restock;
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
  if (!mat || price < 0 || state.gold < price) return false;
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
  return state.displays
    .map((d, index) => (d.ware ? { index, recipeId: d.ware.recipeId } : null))
    .filter(Boolean);
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
