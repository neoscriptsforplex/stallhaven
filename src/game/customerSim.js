/**
 * Customer simulation without any 3D. world.js asks these functions what a
 * new traveller wants and how long they browse, then draws and walks them.
 * A co-op room runs `createCustomerRoom` instead, so every player sees the
 * same travellers with the same requests.
 */
import {
  ASPIRE_CHANCE,
  CUSTOMERS,
  MAX_CUSTOMERS,
  RECIPES,
  REQUEST_WAIT,
  SPAWN_GAP_MAX,
  SPAWN_GAP_MIN,
  SPAWN_BREAK_CHANCE,
  SPAWN_BREAK_MAX,
  SPAWN_BREAK_MIN,
  FIRST_CUSTOMER_DELAY,
  decideRequest,
  mostExpensiveChestId,
  scheduleKingRoald,
} from './catalog.js';
import { defaultRng } from './rng.js';
import { isUnlocked } from './economy.js';

const canCraftNow = (state, recipe) => (state ? isUnlocked(state, recipe.id) : (recipe.tier ?? 1) <= 1);

/**
 * Decide the next traveller. Mutates state.kingRoaldAt the same way the old
 * world code did. Returns { typeId, request, usedFirst } or null.
 */
export function planCustomerSpawn(state, { rng = defaultRng, firstSpawn = false, inShop = 0, kingHere = false } = {}) {
  if (inShop >= MAX_CUSTOMERS) return null;
  if (!state.kingRoaldAt) state.kingRoaldAt = scheduleKingRoald(state.playTime ?? 0, rng);
  const wantKing = !kingHere && (state.playTime ?? 0) >= (state.kingRoaldAt ?? Infinity);
  const recipeId = wantKing ? mostExpensiveChestId(state) : null;
  if (wantKing && recipeId) {
    return {
      typeId: 'kingroald',
      request: { recipeId, gold: RECIPES[recipeId].price, offer: null, royal: true },
      usedFirst: false,
    };
  }
  if (wantKing && !recipeId) {
    state.kingRoaldAt = (state.playTime ?? 0) + 90;
  }
  const types = Object.keys(CUSTOMERS).filter((id) => id !== 'kingroald');
  const typeId = firstSpawn ? 'pilgrim' : types[Math.floor(rng() * types.length)];
  let request = null;
  let pickedType = typeId;
  if (rng() < ASPIRE_CHANCE) {
    request = decideRequest(typeId, rng, state, canCraftNow, 'aspire');
  } else {
    // About 4 in 5 travellers want something the shop can make right now.
    const start = types.indexOf(typeId);
    const order = firstSpawn ? [typeId] : types.map((_, i) => types[(start + i) % types.length]);
    for (const id of order) {
      request = decideRequest(id, rng, state, canCraftNow, 'craftable');
      if (request) { pickedType = id; break; }
    }
    if (!request) request = decideRequest(typeId, rng, state, canCraftNow);
  }
  const finalType = request ? pickedType : typeId;
  if (!request) return { typeId: null, request: null, usedFirst: firstSpawn };
  return { typeId: finalType, request, usedFirst: firstSpawn };
}

export function nextSpawnTime(now, rng = defaultRng) {
  // Sometimes the street goes quiet: a 10-30s lull before the next traveller.
  if (rng() < SPAWN_BREAK_CHANCE) return now + SPAWN_BREAK_MIN + rng() * (SPAWN_BREAK_MAX - SPAWN_BREAK_MIN);
  return now + SPAWN_GAP_MIN + rng() * (SPAWN_GAP_MAX - SPAWN_GAP_MIN);
}

export function pickBrowseStops(spots, rng = defaultRng) {
  const first = spots[Math.floor(rng() * spots.length)];
  const rest = spots.filter((spot) => spot !== first);
  const second = rest[Math.floor(rng() * rest.length)];
  const count = rng() < 0.45 ? 1 : 2;
  return count === 1 ? [first] : [first, second];
}

export function browseWait(rng = defaultRng) {
  return 1.1 + rng() * 1.6;
}

/** Called when the king leaves (sold or not): book his next visit. */
export function rescheduleKing(state, rng = defaultRng) {
  state.kingRoaldAt = scheduleKingRoald(state.playTime ?? 0, rng);
}

/** Roughly how long a traveller takes to walk in and browse before queueing. */
export const ROOM_ARRIVE_SECONDS = 9;

/**
 * Room-side traveller queue (no meshes). `tick` returns events to broadcast:
 *   { op: 'add', customer }  and  { op: 'leave', id, reason: 'timeout' }
 */
export function createCustomerRoom({ rng = defaultRng, now = 0 } = {}) {
  const customers = new Map();
  let serial = 1;
  let nextSpawnAt = now + FIRST_CUSTOMER_DELAY;
  let firstSpawn = true;

  function ordered() {
    return [...customers.values()].sort((a, b) => a.arrivedAt - b.arrivedAt || a.id - b.id);
  }

  function remove(state, id, reason) {
    const c = customers.get(id);
    if (!c) return null;
    customers.delete(id);
    if (c.typeId === 'kingroald') rescheduleKing(state, rng);
    return { op: 'leave', id, reason };
  }

  function tick(state, t) {
    const events = [];
    if (t >= nextSpawnAt) {
      const inShop = customers.size;
      const kingHere = [...customers.values()].some((c) => c.typeId === 'kingroald');
      if (inShop < MAX_CUSTOMERS) {
        const plan = planCustomerSpawn(state, { rng, firstSpawn, inShop, kingHere });
        if (plan?.usedFirst) firstSpawn = false;
        if (plan?.typeId && plan.request) {
          const customer = {
            id: serial,
            typeId: plan.typeId,
            request: {
              recipeId: plan.request.recipeId,
              gold: plan.request.gold,
              offer: plan.request.offer ?? null,
              royal: Boolean(plan.request.royal),
            },
            arrivedAt: t,
            frontSince: null,
          };
          serial += 1;
          customers.set(customer.id, customer);
          nextSpawnAt = nextSpawnTime(t, rng);
          events.push({ op: 'add', customer });
        }
      }
    }
    const line = ordered().filter((c) => t - c.arrivedAt >= ROOM_ARRIVE_SECONDS);
    const front = line[0];
    if (front && front.frontSince == null) front.frontSince = t;
    if (front && t - front.frontSince >= REQUEST_WAIT) {
      const ev = remove(state, front.id, 'timeout');
      if (ev) events.push(ev);
    }
    return events;
  }

  return {
    customers,
    tick,
    remove,
    list: () => ordered(),
    get(id) {
      return customers.get(id) ?? null;
    },
    toJSON() {
      return { serial, nextSpawnAt, firstSpawn, customers: ordered() };
    },
    load(data, t) {
      customers.clear();
      if (!data || typeof data !== 'object') return;
      serial = Number(data.serial) || 1;
      nextSpawnAt = Number.isFinite(data.nextSpawnAt) ? data.nextSpawnAt : t + FIRST_CUSTOMER_DELAY;
      firstSpawn = Boolean(data.firstSpawn);
      for (const c of data.customers ?? []) {
        if (c && Number.isInteger(c.id) && CUSTOMERS[c.typeId] && RECIPES[c.request?.recipeId]) {
          customers.set(c.id, { ...c });
        }
      }
    },
  };
}
