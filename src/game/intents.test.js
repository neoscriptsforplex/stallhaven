import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, startCraftBatch, serializeState } from './economy.js';
import { RECIPES, MINE_DURATION } from './catalog.js';
import {
  applyIntent,
  checkIntentShape,
  createIntentBus,
  GATHER_COOLDOWN_SHARE,
} from './intents.js';

function withChest(recipeId, n = 1) {
  const state = createState();
  state.chest[recipeId] = n;
  return state;
}

test('solo craft intent matches the direct economy call', () => {
  const a = createState();
  const b = createState();
  const viaIntent = applyIntent(a, { type: 'craft', recipeId: 'air_rune', count: 1 }, { now: 5 });
  const direct = startCraftBatch(b, 'air_rune', 1, 5);
  assert.equal(viaIntent.value, direct);
  assert.deepEqual(a.crafts, b.crafts);
  const strip = (st) => {
    const data = { ...serializeState(st), kingRoaldAt: 0 };
    if (data.hq) data.hq = { ...data.hq, lastSeenAt: 0 };
    return data;
  };
  assert.deepEqual(strip(a), strip(b));
});

test('craft intent accepts max', () => {
  const s = createState();
  const r = applyIntent(s, { type: 'craft', recipeId: 'air_rune', count: 'max' }, { now: 0 });
  assert.ok(r.ok);
  assert.ok(r.value >= 1);
});

test('cheats work solo and are refused in co-op', () => {
  const solo = createState();
  const g0 = solo.gold;
  assert.equal(applyIntent(solo, { type: 'cheat', code: 'motherlode' }).value, 'motherlode');
  assert.equal(solo.gold, g0 + 1000000);
  const room = createState();
  const r = applyIntent(room, { type: 'cheat', code: 'motherlode' }, { coop: true });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'cheats-off');
  assert.equal(room.gold, g0);
});

test('shape checks reject junk in co-op', () => {
  assert.equal(checkIntentShape(null), 'not-an-object');
  assert.equal(checkIntentShape({ type: 'nuke' }), 'unknown-type');
  assert.equal(checkIntentShape({ type: 'craft', recipeId: 'nope', count: 1 }), 'bad-recipe');
  assert.equal(checkIntentShape({ type: 'craft', recipeId: 'air_rune', count: -3 }), 'bad-count');
  assert.equal(checkIntentShape({ type: 'buyStation', stationId: 'furnace', pose: { x: 'a', z: 0 } }), 'bad-pose');
  assert.equal(checkIntentShape({ type: 'buyStation', stationId: 'furnace', pose: { x: 1e9, z: 0 } }), 'bad-pose');
  assert.equal(checkIntentShape({ type: 'craft', recipeId: 'air_rune', count: 2 }), null);
  const s = createState();
  assert.equal(applyIntent(s, { type: 'restock', materialId: '__proto__' }, { coop: true }).reason, 'bad-material');
});

test('co-op sale needs a real customer and uses the room price, not the client gold', () => {
  const state = withChest('air_rune', 2);
  const price = RECIPES.air_rune.price;
  const customers = new Map([[7, { id: 7, typeId: 'hedgemage', request: { recipeId: 'air_rune', gold: price, offer: null } }]]);
  const missing = applyIntent(state, { type: 'sell', recipeId: 'air_rune', gold: 999999, customerId: 8 }, { coop: true, customers });
  assert.equal(missing.reason, 'no-customer');
  const g0 = state.gold;
  const r = applyIntent(state, { type: 'sell', recipeId: 'air_rune', gold: 999999, customerId: 7 }, { coop: true, customers });
  assert.ok(r.ok);
  assert.equal(r.value, price);
  assert.equal(state.gold, g0 + price);
  assert.equal(r.leave, 'sold');
  assert.equal(state.chest.air_rune, 1);
});

test('co-op sale fails when the chest is empty', () => {
  const state = createState();
  const customers = { 3: { id: 3, typeId: 'hedgemage', request: { recipeId: 'air_rune', gold: 20, offer: null } } };
  const r = applyIntent(state, { type: 'sell', recipeId: 'air_rune', customerId: 3 }, { coop: true, customers });
  assert.equal(r.ok, false);
  assert.equal(state.gold, createState().gold);
});

test('co-op buy from customer uses the offered price', () => {
  const state = createState();
  state.gold = 100;
  const customers = new Map([[2, { id: 2, typeId: 'pilgrim', request: { recipeId: 'air_rune', gold: 20, offer: { materialId: 'hide', price: 3 } } }]]);
  const wrong = applyIntent(state, { type: 'buyFromCustomer', materialId: 'orb', price: 0, customerId: 2 }, { coop: true, customers });
  assert.equal(wrong.reason, 'wrong-offer');
  const hide0 = state.materials.hide;
  const r = applyIntent(state, { type: 'buyFromCustomer', materialId: 'hide', price: 0, customerId: 2 }, { coop: true, customers });
  assert.ok(r.ok);
  assert.equal(state.gold, 97);
  assert.equal(state.materials.hide, hide0 + 1);
});

test('co-op gathering is limited per player to 85% of the bar', () => {
  const state = createState();
  const gatherLog = new Map();
  const intent = { type: 'gather', mode: 'mine', materialId: 'essence' };
  const ctx = (now, playerId = 'a') => ({ coop: true, now, playerId, gatherLog });
  assert.ok(applyIntent(state, intent, ctx(10)).ok);
  const tooSoon = applyIntent(state, intent, ctx(10 + MINE_DURATION * GATHER_COOLDOWN_SHARE - 0.1));
  assert.equal(tooSoon.reason, 'too-fast');
  assert.ok(applyIntent(state, intent, ctx(10 + 0.5, 'b')).ok, 'another player has their own cooldown');
  assert.ok(applyIntent(state, intent, ctx(10 + MINE_DURATION * GATHER_COOLDOWN_SHARE + 0.01)).ok);
});

test('solo gathering grants material and XP like the old world code', () => {
  const state = createState();
  const before = state.materials.essence ?? 0;
  const xp0 = state.skills.getXp?.('mining') ?? state.skills.toJSON().xp?.mining ?? 0;
  const got = applyIntent(state, { type: 'gather', mode: 'mine', materialId: 'essence' }).value;
  assert.ok(got > 0);
  assert.equal(state.materials.essence, before + got);
  const xp1 = state.skills.getXp?.('mining') ?? state.skills.toJSON().xp?.mining ?? 0;
  assert.ok(xp1 > xp0);
});

test('quest intents start, collect past the cap, and recall with no reward', () => {
  const state = createState();
  state.gold = 80_000;
  assert.equal(applyIntent(state, { type: 'hireHero', classId: 'adventurer', npcId: 'buyer-adventurer-bob' }).value, true);
  assert.equal(applyIntent(state, { type: 'startQuest', questId: 'cow', heroId: 'adventurer' }).value, true);
  assert.equal(state.hq.quests.active.cow.endsAt - state.hq.quests.active.cow.startedAt, 60_000);
  assert.equal(applyIntent(state, { type: 'startQuest', questId: 'imp', heroId: 'adventurer' }).value, false);
  assert.equal(applyIntent(state, { type: 'collectQuest', questId: 'cow' }).value, false);
  state.hq.quests.active.cow.endsAt = Date.now() - 1000;
  const hideBefore = state.materials.hide;
  const collected = applyIntent(state, { type: 'collectQuest', questId: 'cow' });
  assert.equal(collected.ok, true);
  assert.equal(collected.value[0].questId, 'cow');
  assert.equal(state.materials.hide, hideBefore + 5);
  assert.equal(state.hq.quests.done.cow, 1);
  assert.equal(applyIntent(state, { type: 'startQuest', questId: 'chicken', heroId: 'adventurer' }).value, true);
  assert.equal(applyIntent(state, { type: 'recallQuest', questId: 'chicken' }).value, true);
  assert.equal(state.hq.quests.active.chicken, undefined);
  assert.equal(state.hq.quests.done.chicken, undefined);
  assert.equal(checkIntentShape({ type: 'startQuest', questId: 'cow' }), 'bad-quest');
  assert.equal(checkIntentShape({ type: 'collectQuest', questId: 'all' }), null);
  state.materials.essence = 250;
  state.hq.quests.active.dark_wizard = { heroId: 'adventurer', startedAt: 1, endsAt: 1 };
  assert.equal(applyIntent(state, { type: 'collectQuest', questId: 'dark_wizard' }).ok, true);
  assert.equal(state.materials.essence, 750);
});

test('intent bus returns plain values and forwards only accepted intents in co-op', () => {
  const state = createState();
  const bus = createIntentBus({ now: () => 1 });
  bus.bind(state);
  assert.ok(bus.run({ type: 'craft', recipeId: 'air_rune', count: 1 }) >= 1);
  const sent = [];
  bus.setRemote((intent) => sent.push(intent));
  assert.equal(bus.coop, true);
  bus.run({ type: 'restock', materialId: 'hide' });
  state.gold = 0;
  bus.run({ type: 'restock', materialId: 'hide' });
  assert.equal(sent.length, 1);
  assert.equal(bus.run({ type: 'cheat', code: 'motherlode' }), false);
  assert.equal(sent.length, 1);
  bus.setRemote(null);
  assert.equal(bus.coop, false);
});
