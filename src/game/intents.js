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
  fillStandFromRecipe,
  grantChoppedLogs,
  grantFountainWater,
  grantMinedMaterial,
  grantPickedFlax,
  grantPickedWheat,
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
  CHOP_DURATION,
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
import { meetsGatherLevel, xpForChop, xpForMine, xpForPick } from './skills.js';
import { emptyHeroQuestState, hireHero } from './heroesQuests.js';

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
  'placeOnDisplay',
  'clearDisplay',
  'removeFurniture',
  'assignStand',
  'fillStand',
  'buyExpansion',
  'buyStation',
  'buyFurniture',
  'gather',
  'hireHero',
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
  return Infinity;
}

const MAX_ID = 64;
const has = (table, id) => typeof id === 'string' && Object.hasOwn(table, id);
const okId = (v) => typeof v === 'string' && v.length > 0 && v.length <= MAX_ID;
const okIndex = (v) => Number.isInteger(v) && v >= 0 && v < 512;
const okNumber = (v, lim = 200) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim;

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
    case 'gather':
      if (!['mine', 'chop', 'pick', 'water'].includes(intent.mode)) return 'bad-mode';
      if (intent.mode !== 'water' && (!okId(intent.materialId) || !has(MATERIALS, intent.materialId))) return 'bad-material';
      return null;
    case 'hireHero':
      return okId(intent.classId) && okId(intent.npcId) ? null : 'bad-hero';
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
        ? grantPickedWheat(state, WHEAT_YIELD)
        : grantPickedFlax(state, FLAX_YIELD);
    case 'water':
      return grantFountainWater(state, FOUNTAIN_WATER_YIELD);
    default:
      return 0;
  }
}

function gatherXp(state, intent) {
  if (intent.mode === 'pick') state.skills?.addXp('farming', xpForPick(intent.materialId));
  else if (intent.mode === 'chop') state.skills?.addXp('woodcutting', xpForChop(intent.materialId));
  else if (intent.mode === 'mine') state.skills?.addXp('mining', xpForMine(intent.materialId));
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
  return {
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
      return result;
    },
    run(intent) {
      return this.apply(intent).value;
    },
  };
}

export const intentBus = createIntentBus();
