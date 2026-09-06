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
} from './catalog.js';

export function createState() {
  const materials = {};
  for (const mat of Object.values(MATERIALS)) {
    materials[mat.id] = mat.start;
  }
  return {
    gold: START_GOLD,
    materials,
    crafts: {},
    chest: {},
    ready: [],
    displays: SHOP.displays.map(() => ({
      ware: null,
      furnitureId: null,
      slots: emptySlots(),
    })),
    selectedDisplay: 0,
    wareLooks: {},
    log: [],
  };
}

export function canCraft(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return false;
  if (state.crafts[recipeId]) return false;
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
    if (displayKind(index) === 'stand') continue;
    if (display.ware) continue;
    const next = chestIds.find((id) => !shown.has(id));
    if (!next) continue;
    display.ware = { recipeId: next };
    shown.add(next);
  }
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
