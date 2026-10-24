import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from './economy.js';
import { SHOP } from './catalog.js';

function placeStation(state, id) {
  state.furniture[id] = { x: SHOP[id].x, z: SHOP[id].z, rot: 0 };
}
import { FIRST_CUSTOMER_DELAY, MAX_CUSTOMERS, REQUEST_WAIT } from './catalog.js';
import { seededRng } from './rng.js';
import { createCustomerRoom, pickBrowseStops, planCustomerSpawn, ROOM_ARRIVE_SECONDS } from './customerSim.js';

test('seeded rng repeats', () => {
  const a = seededRng(42);
  const b = seededRng(42);
  for (let i = 0; i < 5; i += 1) assert.equal(a(), b());
});

test('first traveller is a pilgrim with a request', () => {
  const s = createState();
  placeStation(s, 'range');
  const plan = planCustomerSpawn(s, { rng: seededRng(1), firstSpawn: true });
  assert.equal(plan.typeId, 'pilgrim');
  const bare = planCustomerSpawn(createState(), { rng: seededRng(1), firstSpawn: true });
  assert.ok(bare.typeId && bare.request.recipeId, 'with no range the first traveller still wants something makeable');
  assert.ok(plan.request.recipeId);
  assert.equal(plan.usedFirst, true);
});

test('no spawn at the customer cap', () => {
  assert.equal(planCustomerSpawn(createState(), { inShop: MAX_CUSTOMERS }), null);
});

test('same seed gives the same plans', () => {
  const p1 = planCustomerSpawn(createState(), { rng: seededRng(9) });
  const p2 = planCustomerSpawn(createState(), { rng: seededRng(9) });
  assert.deepEqual(p1, p2);
});

test('browse stops are one or two distinct spots', () => {
  const spots = [{ x: 1 }, { x: 2 }, { x: 3 }];
  const stops = pickBrowseStops(spots, seededRng(3));
  assert.ok(stops.length === 1 || stops.length === 2);
  if (stops.length === 2) assert.notEqual(stops[0], stops[1]);
});

test('room queue spawns, caps, and times out the front traveller', () => {
  const state = createState();
  placeStation(state, 'range'); // pilgrims only want food, so give them a range
  const room = createCustomerRoom({ rng: seededRng(5), now: 0 });
  assert.deepEqual(room.tick(state, FIRST_CUSTOMER_DELAY - 0.1), []);
  const ev = room.tick(state, FIRST_CUSTOMER_DELAY);
  assert.equal(ev[0].op, 'add');
  assert.equal(ev[0].customer.typeId, 'pilgrim');
  let t = FIRST_CUSTOMER_DELAY;
  for (let i = 0; i < 40; i += 1) {
    t += 1;
    room.tick(state, t);
    assert.ok(room.customers.size <= MAX_CUSTOMERS);
  }
  const firstId = room.list()[0].id;
  let left = null;
  for (let i = 0; i < 200 && !left; i += 1) {
    t += 1;
    left = room.tick(state, t).find((e) => e.op === 'leave');
  }
  assert.ok(left);
  assert.equal(left.id, firstId);
  assert.equal(left.reason, 'timeout');
  assert.ok(t >= FIRST_CUSTOMER_DELAY + ROOM_ARRIVE_SECONDS + REQUEST_WAIT);
});

test('room queue survives a save and load', () => {
  const state = createState();
  const room = createCustomerRoom({ rng: seededRng(5), now: 0 });
  room.tick(state, FIRST_CUSTOMER_DELAY);
  const copy = createCustomerRoom({ rng: seededRng(6), now: 0 });
  copy.load(JSON.parse(JSON.stringify(room.toJSON())), FIRST_CUSTOMER_DELAY);
  assert.deepEqual(copy.list(), room.list());
  assert.equal(copy.remove(state, room.list()[0].id, 'refused').op, 'leave');
});

test('sometimes leaves a 10-30s lull between travellers', async () => {
  const { nextSpawnTime } = await import('./customerSim.js');
  const { SPAWN_GAP_MAX } = await import('./catalog.js');
  const lull = nextSpawnTime(100, (() => { const v = [0.1, 0.5]; return () => v.shift(); })());
  assert.equal(lull, 120);
  const normal = nextSpawnTime(100, (() => { const v = [0.9, 0.5]; return () => v.shift(); })());
  assert.ok(normal - 100 <= SPAWN_GAP_MAX);
});
test('asks mostly for things the shop can craft now', async () => {
  const { planCustomerSpawn } = await import('./customerSim.js');
  const { createState, isUnlocked } = await import('./economy.js');
  let seed = 12345;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const state = createState();
  let can = 0;
  let total = 0;
  for (let i = 0; i < 2000; i += 1) {
    state.kingRoaldAt = Infinity;
    const plan = planCustomerSpawn(state, { rng });
    if (!plan?.request) continue;
    total += 1;
    if (isUnlocked(state, plan.request.recipeId)) can += 1;
  }
  const ratio = can / total;
  assert.ok(ratio > 0.7 && ratio < 0.9, String(ratio));
});
test('quest-only and fishing-only starting stock', async () => {
  const { MATERIALS } = await import('./catalog.js');
  for (const id of ['redberries', 'pineapple', 'chocolate', 'hide', 'egg']) {
    assert.equal(MATERIALS[id].start, 5, id);
    assert.ok(!MATERIALS[id].restock && !MATERIALS[id].regenEvery, id);
  }
  for (const m of Object.values(MATERIALS)) if (m.fished || m.id.endsWith('_dhide')) assert.equal(m.start, 0, m.id);
});

test('requests never need a locked station unless the item is already in stock', async () => {
  const { planCustomerSpawn } = await import('./customerSim.js');
  const { createState, recipeStationOwned } = await import('./economy.js');
  let seed = 777;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const state = createState();
  state.chest.attack_potion = 1;
  let sawStocked = false;
  for (let i = 0; i < 3000; i += 1) {
    state.kingRoaldAt = Infinity;
    const plan = planCustomerSpawn(state, { rng });
    if (!plan?.request) continue;
    const id = plan.request.recipeId;
    if (id === 'attack_potion') sawStocked = true;
    else assert.ok(recipeStationOwned(state, id), id);
  }
  assert.ok(sawStocked, 'a stocked potion can still be asked for with no cauldron');
});

test('trees sink so their trunks meet the lawn', async () => {
  const { TREE_ROOT_SINK } = await import('./shopbuild.js');
  assert.ok(TREE_ROOT_SINK >= 0.05);
});
