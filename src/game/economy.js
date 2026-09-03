import {
  CUSTOMERS,
  MATERIALS,
  OTHER_CHANCE,
  RECIPES,
  START_GOLD,
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
    ready: [],
    displays: [{ ware: null, furnitureId: null }, { ware: null, furnitureId: null }],
    selectedDisplay: 0,
    wareLooks: {},
    log: [],
  };
}

export function canCraft(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return false;
  if (state.crafts[recipeId]) return false;
  return (state.materials[recipe.material] ?? 0) >= 1;
}

export function startCraft(state, recipeId, nowSeconds) {
  const recipe = RECIPES[recipeId];
  if (!canCraft(state, recipeId)) return false;
  state.materials[recipe.material] -= 1;
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

export function completeCrafts(state, nowSeconds) {
  const finished = [];
  for (const [recipeId, craft] of Object.entries(state.crafts)) {
    if (nowSeconds - craft.startedAt >= craft.duration) {
      delete state.crafts[recipeId];
      state.ready.push(recipeId);
      finished.push(recipeId);
    }
  }
  if (finished.length) autoStock(state);
  return finished;
}

export function autoStock(state) {
  while (state.ready.length) {
    const empty = state.displays.findIndex((d) => !d.ware);
    if (empty < 0) break;
    const recipeId = state.ready.shift();
    state.displays[empty].ware = { recipeId };
  }
}

export function stockSelected(state, recipeId) {
  if (!recipeId) {
    recipeId = state.ready[0];
    if (!recipeId) return false;
  }
  const idx = state.ready.indexOf(recipeId);
  if (idx < 0) return false;
  const display = state.displays[state.selectedDisplay];
  if (display.ware) {
    state.ready.push(display.ware.recipeId);
  }
  state.ready.splice(idx, 1);
  display.ware = { recipeId };
  return true;
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
  display.ware = null;
  autoStock(state);
  return recipeId;
}

export function sellFromDisplay(state, displayIndex) {
  const recipeId = removeWare(state, displayIndex);
  if (!recipeId) return 0;
  const recipe = RECIPES[recipeId];
  state.gold += recipe.price;
  return recipe.price;
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
  state.log = state.log.slice(0, 4);
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
