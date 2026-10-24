/**
 * Player actions as small plain objects ("intents"), applied by one function.
 *
 * Single-player runs every shop action through `intentBus.run(intent)`, which
 * calls `applyIntent` on the local state and returns the same value the old
 * direct call returned, so play is unchanged. A co-op room server calls the
 * same `applyIntent` with `ctx.coop = true` to validate and apply what a
 * player asked for. Every intent can carry `by` (the player id) so later
 * features such as trading know who did what.
 */
import {
  applyCheat,
  assignStandPiece,
  buyExpansion,
  buyFromCustomer,
  buyFurniture,
  buyStation,
  cancelCrafts,
  clearDisplay,
  discardFromChest,
  discardMaterial,
  fillStandFromRecipe,
  grantCaughtFish,
  grantChoppedLogs,
  grantFountainWater,
  grantMinedMaterial,
  grantPickedFlax,
  grantPickedWheat,
  harvestHerb,
  moveFarmingPatch,
  plantHerb,
  removeFarmingPatch,
  offerChoices,
  placeFromChest,
  placeOnDisplay,
  removePlacedFurniture,
  restock,
  sellToCustomer,
  startCraftBatch,
  upgradeChest,
} from './economy.js';
import {
  GROW_BY_ID,
  CHOP_DURATION,
  FISH_DURATION,
  FLAX_DURATION,
  FLAX_YIELD,
  FOUNTAIN_DURATION,
  FOUNTAIN_WATER_YIELD,
  MATERIALS,
  RECIPES,
  WHEAT_DURATION,
  WHEAT_YIELD,
  chopYield,
  mineTiming,
} from './catalog.js';
import { meetsGatherLevel, xpForChop, xpForFish, xpForMine, xpForPick } from './skills.js';
import {
  moveConstruction,
  pickupConstruction,
  placeConstruction,
  sellConstruction,
} from './construction.js';
import {
  emptyHeroQuestState,
  collectQuest,
  grantQuestReward,
  hireHero,
  readyQuests,
  recallQuest,
  retireHero,
  startQuest,
} from './heroesQuests.js';

export const INTENT_TYPES = Object.freeze([
  'craft',
  'cancelCrafts',
  'restock',
  'sell',
  'buyFromCustomer',
  'refuseCustomer',
  'upgradeChest',
  'placeFromChest',
  'discard',
  'discardMaterial',
  'placeOnDisplay',
  'clearDisplay',
  'removeFurniture',
  'assignStand',
  'fillStand',
  'buyExpansion',
  'buyStation',
  'buyFurniture',
  'removePatch',
  'movePatch',
  'moveFurniture',
  'plantHerb',
  'harvestHerb',
  'placePiece',
  'movePiece',
  'pickupPiece',
  'sellPiece',
  'gather',
  'hireHero',
  'startQuest',
  'collectQuest',
  'recallQuest',
  'retireHero',
  'cheat',
]);

/** Gathering: how long one bar takes, in seconds (rooms allow 85% of it between grants). */
export const GATHER_COOLDOWN_SHARE = 0.85;
/** Fountain fills run on a gathering bar (same length as mining). */
export const FOUNTAIN_COOLDOWN = FOUNTAIN_DURATION;

export function gatherDuration(mode, materialId) {
  if (mode === 'mine') return mineTiming(materialId).duration;
  if (mode === 'chop') return CHOP_DURATION;
  if (mode === 'pick') return materialId === 'wheat' ? WHEAT_DURATION : FLAX_DURATION;
  if (mode === 'water') return FOUNTAIN_COOLDOWN;
  if (mode === 'fish') return FISH_DURATION;
  return Infinity;
}

const MAX_ID = 64;
const has = (table, id) => typeof id === 'string' && Object.hasOwn(table, id);
const okId = (v) => typeof v === 'string' && v.length > 0 && v.length <= MAX_ID;
const okIndex = (v) => Number.isInteger(v) && v >= 0 && v < 512;
const okNumber = (v, lim = 200) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim;

/** Fixtures that move with Move/Rotate. Pieces and patches have their own intents. */
const FIXTURE_IDS = new Set([
  'chest', 'counter', 'rug', 'anvil', 'range', 'cauldron', 'furnace', 'wheel', 'loom',
  'fletch', 'potter', 'sawmill', 'portal', 'display',
]);

/** Write a moved fixture's final pose so co-op rooms keep it (it used to be local-only). */
export function moveFixture(state, furnitureId, index, pose) {
  if (!state?.furniture || !pose || !FIXTURE_IDS.has(furnitureId)) return false;
  const row = furnitureId === 'display'
    ? state.furniture.displays?.[index]
    : state.furniture[furnitureId];
  if (!row || typeof row !== 'object') return false;
  row.x = pose.x;
  row.z = pose.z;
  if (Number.isFinite(pose.rot)) row.rot = pose.rot;
  return true;
}

function cleanPose(pose) {
  if (!pose || typeof pose !== 'object') return null;
  if (!okNumber(pose.x) || !okNumber(pose.z)) return null;
  const rot = okNumber(pose.rot, 100) ? pose.rot : undefined;
  return rot === undefined ? { x: pose.x, z: pose.z } : { x: pose.x, z: pose.z, rot };
}

const fail = (reason) => ({ ok: false, value: false, reason });
const done = (value, extra = {}) => ({ ok: Boolean(value), value, reason: value ? null : 'refused', ...extra });

/** Shape check only. Returns a reason string, or null when the intent is well formed. */
export function checkIntentShape(intent) {
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) return 'not-an-object';
  if (!INTENT_TYPES.includes(intent.type)) return 'unknown-type';
  switch (intent.type) {
    case 'craft':
      if (!okId(intent.recipeId) || !has(RECIPES, intent.recipeId)) return 'bad-recipe';
      if (intent.count !== 'max' && !(Number.isInteger(intent.count) && intent.count >= 1 && intent.count <= 10000)) {
        return 'bad-count';
      }
      return null;
    case 'restock':
      return okId(intent.materialId) && has(MATERIALS, intent.materialId) ? null : 'bad-material';
    case 'sell':
      if (!okId(intent.recipeId) || !has(RECIPES, intent.recipeId)) return 'bad-recipe';
      if (intent.gold != null && !okNumber(intent.gold, 1e12)) return 'bad-gold';
      return null;
    case 'buyFromCustomer':
      if (!okId(intent.materialId) || !has(MATERIALS, intent.materialId)) return 'bad-material';
      if (intent.price != null && !okNumber(intent.price, 1e12)) return 'bad-price';
      return null;
    case 'placeFromChest':
    case 'discard':
      return okId(intent.recipeId) && has(RECIPES, intent.recipeId) ? null : 'bad-recipe';
    case 'discardMaterial':
      if (!okId(intent.materialId) || !has(MATERIALS, intent.materialId)) return 'bad-material';
      if (intent.amount !== 'all' && !okNumber(intent.amount, 1e9)) return 'bad-amount';
      return null;
    case 'placeOnDisplay':
      if (!okId(intent.recipeId) || !has(RECIPES, intent.recipeId)) return 'bad-recipe';
      if (!okIndex(intent.displayIndex)) return 'bad-index';
      if (intent.slotIndex != null && !okIndex(intent.slotIndex)) return 'bad-slot';
      return null;
    case 'clearDisplay':
    case 'removeFurniture':
      return okIndex(intent.index) ? null : 'bad-index';
    case 'assignStand':
    case 'fillStand':
      if (!okIndex(intent.index)) return 'bad-index';
      return okId(intent.recipeId) && has(RECIPES, intent.recipeId) ? null : 'bad-recipe';
    case 'buyExpansion':
      return okId(intent.padId) ? null : 'bad-pad';
    case 'buyStation':
      if (!okId(intent.stationId)) return 'bad-station';
      return cleanPose(intent.pose) ? null : 'bad-pose';
    case 'buyFurniture':
      if (!okId(intent.furnitureType)) return 'bad-furniture';
      return cleanPose(intent.pose) ? null : 'bad-pose';
    case 'removePatch':
    case 'harvestHerb':
      return okIndex(intent.index) ? null : 'bad-index';
    case 'moveFurniture':
      if (typeof intent.furnitureId !== 'string' || !FIXTURE_IDS.has(intent.furnitureId)) return 'bad-furniture';
      if (intent.furnitureId === 'display' && !okIndex(intent.index)) return 'bad-index';
      return cleanPose(intent.pose) ? null : 'bad-pose';
    case 'movePatch':
      if (!okIndex(intent.index)) return 'bad-index';
      return cleanPose(intent.pose) ? null : 'bad-pose';
    case 'plantHerb':
      if (!okIndex(intent.index)) return 'bad-index';
      return okId(intent.recipeId) && GROW_BY_ID[intent.recipeId] ? null : 'bad-herb';
    case 'placePiece':
      return okId(intent.pieceId) && cleanPose(intent.pose) ? null : 'bad-piece';
    case 'movePiece':
      return okIndex(intent.index) && cleanPose(intent.pose) ? null : 'bad-piece';
    case 'pickupPiece':
    case 'sellPiece':
      return okIndex(intent.index) ? null : 'bad-piece';
    case 'gather':
      if (!['mine', 'chop', 'pick', 'water', 'fish'].includes(intent.mode)) return 'bad-mode';
      if (intent.mode !== 'water' && (!okId(intent.materialId) || !has(MATERIALS, intent.materialId))) return 'bad-material';
      return null;
    case 'hireHero':
      return okId(intent.classId) && okId(intent.npcId) ? null : 'bad-hero';
    case 'startQuest':
      return okId(intent.questId) && okId(intent.heroId) ? null : 'bad-quest';
    case 'collectQuest':
      return intent.questId === 'all' || okId(intent.questId) ? null : 'bad-quest';
    case 'recallQuest':
      return okId(intent.questId) ? null : 'bad-quest';
    case 'retireHero':
      return typeof intent.classId === 'string' && intent.classId.length <= 24 ? null : 'bad-class';
    case 'cheat':
      return typeof intent.code === 'string' && intent.code.length <= 40 ? null : 'bad-code';
    default:
      return null;
  }
}

function findCustomer(ctx, id) {
  if (!ctx.customers) return null;
  if (ctx.customers instanceof Map) return ctx.customers.get(id) ?? null;
  return ctx.customers[id] ?? null;
}

function gatherAmount(state, intent) {
  switch (intent.mode) {
    case 'mine':
      return grantMinedMaterial(state, intent.materialId, mineTiming(intent.materialId).yield);
    case 'chop':
      return grantChoppedLogs(state, chopYield(intent.materialId), intent.materialId);
    case 'pick':
      return intent.materialId === 'wheat'
        ? grantPickedWheat(state)
        : grantPickedFlax(state);
    case 'water':
      return grantFountainWater(state);
    case 'fish':
      return grantCaughtFish(state, intent.materialId);
    default:
      return 0;
  }
}

function gatherXp(state, intent) {
  if (intent.mode === 'pick') state.skills?.addXp('farming', xpForPick(intent.materialId));
  else if (intent.mode === 'chop') state.skills?.addXp('woodcutting', xpForChop(intent.materialId));
  else if (intent.mode === 'mine') state.skills?.addXp('mining', xpForMine(intent.materialId));
  else if (intent.mode === 'fish') state.skills?.addXp('fishing', xpForFish(intent.materialId));
}

/**
 * Quest timers are wall-clock milliseconds. The room clock and the intent bus
 * clock are seconds, so these always use Date.now() on the machine applying them.
 */
function applyQuestIntent(state, intent) {
  if (!state.hq) state.hq = emptyHeroQuestState();
  const now = Date.now();
  if (intent.type === 'startQuest') return done(startQuest(state.hq, intent.questId, intent.heroId, now, state.skills?.getLevel?.('crafting') ?? 1));
  if (intent.type === 'recallQuest') return done(recallQuest(state.hq, intent.questId));
  const ids = intent.questId === 'all' ? readyQuests(state.hq, now) : [intent.questId];
  const rows = [];
  for (const id of ids) {
    const rewards = collectQuest(state.hq, id, (materialId, amount) => {
      grantQuestReward(state.materials, materialId, amount);
    }, now);
    if (rewards) rows.push({ questId: id, rewards });
  }
  return done(rows.length ? rows : false);
}

/**
 * Apply one intent to `state`.
 * ctx: { now, coop, playerId, customers (Map|object, rooms only), gatherLog (rooms only) }
 * Returns { ok, value, reason, ... }. `value` is what the old direct call returned.
 */
export function applyIntent(state, intent, ctx = {}) {
  const coop = Boolean(ctx.coop);
  if (coop) {
    const bad = checkIntentShape(intent);
    if (bad) return fail(bad);
    if (['placePiece', 'movePiece', 'pickupPiece', 'sellPiece'].includes(intent.type) && ctx.host !== true) {
      return fail('host-only');
    }
  } else if (!intent || !INTENT_TYPES.includes(intent.type)) {
    return fail('unknown-type');
  }
  const now = Number.isFinite(ctx.now) ? ctx.now : 0;
  switch (intent.type) {
    case 'craft': {
      const want = intent.count === 'max' || intent.count === Infinity ? 'max' : intent.count;
      return done(startCraftBatch(state, intent.recipeId, want, now));
    }
    case 'cancelCrafts':
      return done(cancelCrafts(state));
    case 'restock':
      return done(restock(state, intent.materialId));
    case 'sell': {
      if (!coop) return done(sellToCustomer(state, intent.recipeId, intent.gold));
      const customer = findCustomer(ctx, intent.customerId);
      if (!customer) return fail('no-customer');
      const want = customer.request?.recipeId;
      let gold;
      if (intent.recipeId === want) {
        gold = customer.request.gold;
      } else {
        const choice = offerChoices(state, want).find((item) => item.recipeId === intent.recipeId);
        if (!choice) return fail('not-offerable');
        gold = choice.gold;
      }
      const paid = sellToCustomer(state, intent.recipeId, gold);
      return done(paid, { customerId: customer.id, leave: paid ? 'sold' : null });
    }
    case 'buyFromCustomer': {
      if (!coop) return done(buyFromCustomer(state, intent.materialId, intent.price));
      const customer = findCustomer(ctx, intent.customerId);
      const offer = customer?.request?.offer;
      if (!offer) return fail('no-offer');
      if (offer.materialId !== intent.materialId) return fail('wrong-offer');
      const ok = buyFromCustomer(state, offer.materialId, offer.price);
      return done(ok, { customerId: customer.id, leave: ok ? 'bought' : null });
    }
    case 'refuseCustomer': {
      if (!coop) return done(true);
      const customer = findCustomer(ctx, intent.customerId);
      if (!customer) return fail('no-customer');
      return done(true, { customerId: customer.id, leave: 'refused' });
    }
    case 'upgradeChest':
      return done(upgradeChest(state));
    case 'placeFromChest':
      return done(placeFromChest(state, intent.recipeId));
    case 'discard':
      return done(discardFromChest(state, intent.recipeId));
    case 'discardMaterial':
      return done(discardMaterial(state, intent.materialId, intent.amount));
    case 'placeOnDisplay':
      return done(placeOnDisplay(state, intent.recipeId, intent.displayIndex, intent.slotIndex ?? 0));
    case 'clearDisplay':
      return done(clearDisplay(state, intent.index));
    case 'removeFurniture':
      return done(removePlacedFurniture(state, intent.index));
    case 'assignStand':
      return done(assignStandPiece(state, intent.index, intent.recipeId));
    case 'fillStand':
      return done(fillStandFromRecipe(state, intent.index, intent.recipeId));
    case 'buyExpansion':
      return done(buyExpansion(state, intent.padId));
    case 'buyStation':
      return done(buyStation(state, intent.stationId, coop ? cleanPose(intent.pose) : intent.pose));
    case 'buyFurniture':
      return done(buyFurniture(state, intent.furnitureType, coop ? cleanPose(intent.pose) : intent.pose));
    case 'removePatch':
      return done(removeFarmingPatch(state, intent.index));
    case 'moveFurniture':
      return done(moveFixture(state, intent.furnitureId, intent.index, cleanPose(intent.pose)));
    case 'movePatch':
      return done(moveFarmingPatch(state, intent.index, coop ? cleanPose(intent.pose) : intent.pose));
    case 'plantHerb':
    case 'harvestHerb': {
      const now = Date.now();
      const value = intent.type === 'plantHerb'
        ? plantHerb(state, intent.index, intent.recipeId, now)
        : harvestHerb(state, intent.index, now);
      return done(value);
    }
    case 'placePiece':
      return done(placeConstruction(state, intent.pieceId, intent.pose));
    case 'movePiece':
      return done(moveConstruction(state, intent.index, intent.pose));
    case 'pickupPiece':
      return done(pickupConstruction(state, intent.index));
    case 'sellPiece':
      return done(sellConstruction(state, intent.index));
    case 'gather': {
      if (coop) {
        if (intent.mode !== 'water' && !meetsGatherLevel(state, intent.materialId)) return fail('level');
        const log = ctx.gatherLog;
        if (log) {
          const key = `${ctx.playerId ?? 'p'}:${intent.mode}`;
          const last = log.get(key);
          const gap = gatherDuration(intent.mode, intent.materialId) * GATHER_COOLDOWN_SHARE;
          if (last != null && now - last < gap) return fail('too-fast');
          log.set(key, now);
        }
      }
      const got = gatherAmount(state, intent);
      if (got > 0) gatherXp(state, intent);
      return { ok: true, value: got, reason: null };
    }
    case 'hireHero':
      if (!state.hq) state.hq = emptyHeroQuestState();
      return done(hireHero(state, state.hq, intent.classId, intent.npcId, ctx.rng ?? Math.random));
    case 'startQuest':
    case 'collectQuest':
    case 'recallQuest':
      return applyQuestIntent(state, intent);
    case 'retireHero':
      if (!state.hq) return fail('no-hero');
      return done(retireHero(state.hq, intent.classId));
    case 'cheat':
      if (coop) return fail('cheats-off');
      return done(applyCheat(state, intent.code));
    default:
      return fail('unknown-type');
  }
}

/**
 * The browser's one entry point for shop actions.
 * Solo: applies locally and returns the result value.
 * Co-op: also applies locally (instant feedback) and forwards the intent to the
 * room, whose answer overwrites the shared state when it arrives.
 */
export function createIntentBus(clock = { now: () => (typeof performance !== 'undefined' ? performance.now() / 1000 : 0) }) {
  let state = null;
  let remote = null;
  const listeners = new Set();
  return {
    /** fn(intent, result) after every local apply (sound effects, etc.). Returns an unsubscribe. */
    onResult(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    bind(nextState) {
      state = nextState;
    },
    /** send(intent) forwards to the room; null switches back to solo. */
    setRemote(send) {
      remote = typeof send === 'function' ? send : null;
    },
    get coop() {
      return Boolean(remote);
    },
    apply(intent) {
      if (!state) return fail('no-state');
      const result = applyIntent(state, intent, { now: clock.now(), coop: Boolean(remote) && intent?.type === 'cheat' });
      if (remote && result.ok) remote(intent);
      for (const fn of listeners) {
        try { fn(intent, result); } catch { /* a listener must never break an action */ }
      }
      return result;
    },
    run(intent) {
      return this.apply(intent).value;
    },
  };
}

export const intentBus = createIntentBus();
