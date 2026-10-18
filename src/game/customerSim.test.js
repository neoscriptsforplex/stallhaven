import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from './economy.js';
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
  const plan = planCustomerSpawn(s, { rng: seededRng(1), firstSpawn: true });
  assert.equal(plan.typeId, 'pilgrim');
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
