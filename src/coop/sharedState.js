/**
 * Which parts of the shop are shared in a co-op room, and how they travel.
 * The room sends whole top-level keys that changed ("patches"); a client
 * writes them into its state through the normal save loader, so a bad value
 * can't break the shop.
 */
import { applyState, createState, serializeState } from '../game/economy.js';

export const SHARED_KEYS = Object.freeze([
  'gold',
  'materials',
  'chest',
  'chestLevel',
  'craftCounts',
  'displays',
  'furniture',
  'expansions',
  'boughtFurniture',
  'freeFurnitureReplace',
  'shopXp',
  'skills',
  'chefHat',
]);

/** Keys whose change means the 3D shop has to be rebuilt. */
export const LAYOUT_KEYS = Object.freeze(['furniture', 'expansions', 'boughtFurniture']);

export function sharedView(state) {
  const data = serializeState(state);
  const out = {};
  for (const key of SHARED_KEYS) out[key] = data[key];
  return out;
}

export function craftsView(state) {
  const out = {};
  for (const [id, c] of Object.entries(state.crafts ?? {})) {
    if (!c) continue;
    out[id] = { startedAt: c.startedAt, duration: c.duration, left: c.left ?? 1, total: c.total ?? c.left ?? 1 };
  }
  return out;
}

/** Remembers what was last sent and returns only what changed. */
export function createDiffer() {
  let last = {};
  return {
    diff(state, { force = false } = {}) {
      const view = sharedView(state);
      view.crafts = craftsView(state);
      const set = {};
      let any = false;
      for (const [key, value] of Object.entries(view)) {
        const json = JSON.stringify(value);
        if (force || last[key] !== json) {
          set[key] = value;
          last[key] = json;
          any = true;
        }
      }
      return any ? set : null;
    },
    reset() {
      last = {};
    },
  };
}

/**
 * Write shared keys into a client state. `toLocal(serverSeconds)` turns room
 * times into this browser's clock for crafts. Returns the keys that changed.
 */
export function applySharedPatch(state, set, toLocal = (t) => t) {
  if (!set || typeof set !== 'object') return [];
  const keys = SHARED_KEYS.filter((k) => Object.hasOwn(set, k));
  if (keys.length) {
    const base = serializeState(state);
    for (const k of keys) base[k] = set[k];
    if (!base.skills) base.skills = state.skills?.toJSON?.() ?? {};
    const temp = createState();
    if (applyState(temp, base)) {
      for (const k of keys) {
        if (k === 'skills') {
          if (state.skills?.fromJSON) state.skills.fromJSON(set.skills);
          else state.skills = temp.skills;
        } else {
          state[k] = temp[k];
        }
      }
      // Derived fields the loader rebuilds alongside displays/chest.
      state.ready = temp.ready;
      if (keys.includes('shopXp')) state.shopLevel = temp.shopLevel;
      if (keys.includes('displays') && state.selectedDisplay >= state.displays.length) state.selectedDisplay = 0;
    }
  }
  if (Object.hasOwn(set, 'crafts') && set.crafts && typeof set.crafts === 'object') {
    const crafts = {};
    for (const [id, c] of Object.entries(set.crafts)) {
      if (!c || !Number.isFinite(c.startedAt) || !Number.isFinite(c.duration)) continue;
      crafts[id] = { startedAt: toLocal(c.startedAt), duration: c.duration, left: c.left ?? 1, total: c.total ?? 1 };
    }
    state.crafts = crafts;
    keys.push('crafts');
  }
  return keys;
}
