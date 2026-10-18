import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes as nodeRandom } from 'node:crypto';
import { createRoomCore } from './roomCore.js';
import { manualClock } from '../game/clock.js';
import { seededRng } from '../game/rng.js';
import { createState, serializeState } from '../game/economy.js';
import { CLOSE, COLORS, HOLD_SECONDS, cleanName, isValidCode, makeCode, normalizeCode, uniqueName } from './protocol.js';

const rb = (n) => new Uint8Array(nodeRandom(n));

function setup({ max = 4 } = {}) {
  const clock = manualClock(1000);
  const room = createRoomCore({ code: 'ABC234', now: clock.now, rng: seededRng(7), randomBytes: rb, maxPlayers: max });
  room.claim('hostkey');
  const inbox = new Map();
  const closed = new Map();
  const route = (outs) => {
    for (const o of outs) {
      if (o.close) {
        closed.set(o.close, o);
        continue;
      }
      const targets = o.to === 'all' ? [...inbox.keys()].filter((id) => id !== o.except && !closed.has(id)) : [o.to];
      for (const id of targets) inbox.get(id)?.push(o.msg);
    }
  };
  const open = (id) => {
    inbox.set(id, []);
    route(room.connect(id, 'local'));
  };
  const say = (id, msg) => route(room.message(id, JSON.stringify(msg)));
  const last = (id, t) => [...inbox.get(id)].reverse().find((m) => m.t === t);
  const tick = (dt = 1) => {
    clock.advance(dt);
    route(room.tick());
  };
  const drop = (id) => {
    route(room.disconnect(id));
  };
  const save = serializeState(Object.assign(createState(), { gold: 500 }));
  return { room, clock, inbox, closed, open, say, last, tick, drop, save };
}

function hostAndGuest(t, names = ['Luke', 'Sam']) {
  t.open('h');
  t.say('h', { t: 'hello', name: names[0], hostKey: 'hostkey', save: t.save });
  t.open('g');
  t.say('g', { t: 'hello', name: names[1] });
}

test('codes use the agreed alphabet', () => {
  for (let i = 0; i < 50; i += 1) assert.ok(isValidCode(makeCode(rb)));
  assert.equal(isValidCode('ABC1O0'), false);
  assert.equal(normalizeCode(' abc-234 '), 'ABC234');
});

test('names: 1-16 letters, numbers or spaces; duplicates get (2)', () => {
  assert.equal(cleanName('  Sam  '), 'Sam');
  assert.equal(cleanName(''), null);
  assert.equal(cleanName('x'.repeat(17)), null);
  assert.equal(cleanName('<script>'), null);
  assert.equal(uniqueName('Sam', ['Luke', 'sam']), 'Sam (2)');
});

test('host joins with the key and the room runs on the host save', (tt) => {
  const t = setup();
  t.open('h');
  t.say('h', { t: 'hello', name: 'Luke', hostKey: 'hostkey', save: t.save });
  const ok = t.last('h', 'join_ok');
  assert.ok(ok);
  assert.equal(ok.you.host, true);
  assert.equal(ok.you.color, 'red');
  assert.equal(ok.snapshot.shared.gold, 500);
  assert.ok(ok.you.token.length > 20);
});

test('guests need the room to be opened by the host first', () => {
  const t = setup();
  t.open('g');
  t.say('g', { t: 'hello', name: 'Sam' });
  assert.equal(t.last('g', 'join_error').reason, 'not_found');
});

test('slots fill red, blue, green, purple and the fifth is refused', () => {
  const t = setup();
  t.open('h');
  t.say('h', { t: 'hello', name: 'Luke', hostKey: 'hostkey', save: t.save });
  for (const id of ['a', 'b', 'c']) {
    t.open(id);
    t.say(id, { t: 'hello', name: 'Sam' });
  }
  assert.deepEqual(t.last('c', 'join_ok').players.map((p) => p.color), COLORS);
  assert.deepEqual(t.last('c', 'join_ok').players.map((p) => p.name), ['Luke', 'Sam', 'Sam (2)', 'Sam (3)']);
  t.open('e');
  t.say('e', { t: 'hello', name: 'Eve' });
  assert.equal(t.last('e', 'join_error').reason, 'room_full');
  assert.equal(t.closed.get('e').code, CLOSE.JOIN_ERROR);
});

test('bad names are refused', () => {
  const t = setup();
  t.open('h');
  t.say('h', { t: 'hello', name: 'Luke', hostKey: 'hostkey', save: t.save });
  t.open('g');
  t.say('g', { t: 'hello', name: '!!!' });
  assert.equal(t.last('g', 'join_error').reason, 'bad_name');
});

test('shared gold: a guest restock is validated and everyone gets the patch', () => {
  const t = setup();
  hostAndGuest(t);
  t.say('g', { t: 'intent', n: 1, intent: { type: 'restock', materialId: 'hide' } });
  assert.equal(t.last('g', 'ack').ok, true);
  const patch = t.last('h', 'patch');
  assert.ok(patch.set.gold < 500);
  assert.equal(t.room._state().gold, patch.set.gold);
});

test('cheats and junk intents are refused and resynced', () => {
  const t = setup();
  hostAndGuest(t);
  t.say('g', { t: 'intent', n: 2, intent: { type: 'cheat', code: 'motherlode' } });
  assert.equal(t.last('g', 'ack').reason, 'cheats-off');
  assert.equal(t.last('g', 'patch').full, true);
  t.say('g', { t: 'intent', n: 3, intent: { type: 'craft', recipeId: 'nope', count: 1 } });
  assert.equal(t.last('g', 'ack').reason, 'bad-recipe');
  assert.equal(t.room._state().gold, 500);
});

test('oversized and flood messages are capped', () => {
  const t = setup();
  hostAndGuest(t);
  t.say('g', { t: 'move', x: 1, z: 1, pad: 'x'.repeat(5000) });
  assert.equal(t.last('g', 'error').reason, 'too_big');
  for (let i = 0; i < 100; i += 1) t.say('g', { t: 'move', x: 1, z: 1 });
  assert.ok(t.inbox.get('g').some((m) => m.t === 'error' && m.reason === 'rate_limited'));
  t.clock.advance(5);
  t.inbox.set('h', []);
  t.say('g', { t: 'move', x: 2, z: 2 });
  assert.ok(t.last('h', 'move'), 'bucket refills');
});

test('guest reconnects with the token inside 2 minutes', () => {
  const t = setup();
  hostAndGuest(t);
  const token = t.last('g', 'join_ok').you.token;
  t.drop('g');
  assert.equal(t.last('h', 'player_dropped').player.name, 'Sam');
  t.tick(60);
  t.open('g2');
  t.say('g2', { t: 'hello', name: 'Sam', token });
  assert.equal(t.last('g2', 'join_ok').you.name, 'Sam');
  assert.equal(t.last('h', 'player_reconnected').player.name, 'Sam');
});

test('guest slot is freed after 2 minutes away', () => {
  const t = setup();
  hostAndGuest(t);
  t.drop('g');
  t.tick(HOLD_SECONDS + 1);
  assert.equal(t.last('h', 'player_left').player.name, 'Sam');
  assert.equal(t.room.playerCount(), 1);
});

test('host drop: host_waiting, actions pause, then host_left after 2 minutes', () => {
  const t = setup();
  hostAndGuest(t);
  t.drop('h');
  assert.equal(t.last('g', 'host_waiting').secondsLeft, HOLD_SECONDS);
  t.say('g', { t: 'intent', n: 9, intent: { type: 'restock', materialId: 'hide' } });
  assert.equal(t.last('g', 'ack').reason, 'paused');
  t.tick(HOLD_SECONDS + 1);
  assert.equal(t.last('g', 'room_ended').reason, 'host_left');
  assert.equal(t.room.exists(), false);
});

test('host comes back in time and the room carries on', () => {
  const t = setup();
  hostAndGuest(t);
  const token = t.last('h', 'join_ok').you.token;
  t.drop('h');
  t.tick(30);
  t.open('h2');
  t.say('h2', { t: 'hello', name: 'Luke', token });
  assert.equal(t.last('h2', 'join_ok').you.host, true);
  assert.equal(t.last('g', 'player_reconnected').player.host, true);
  t.tick(HOLD_SECONDS);
  assert.equal(t.room.exists(), true);
});

test('host leave or end ends the room at once with host_ended', () => {
  const t = setup();
  hostAndGuest(t);
  t.say('h', { t: 'end' });
  assert.equal(t.last('g', 'room_ended').reason, 'host_ended');
  assert.equal(t.closed.get('g').code, CLOSE.ENDED);
});

test('kicked players are banned from the room', () => {
  const t = setup();
  hostAndGuest(t);
  const you = t.last('g', 'join_ok').you;
  t.say('g', { t: 'kick', id: t.last('g', 'join_ok').players[0].id });
  assert.equal(t.room.playerCount(), 2, 'guests cannot kick');
  t.say('h', { t: 'kick', id: you.id });
  assert.equal(t.last('g', 'room_ended').reason, 'kicked');
  t.open('g2');
  t.say('g2', { t: 'hello', name: 'Sam', token: you.token });
  assert.equal(t.last('g2', 'join_error').reason, 'kicked');
});

test('the room spawns travellers and a guest can sell to one', () => {
  const t = setup();
  hostAndGuest(t);
  t.room._state().chest.air_rune = 5;
  let add = null;
  for (let i = 0; i < 30 && !add; i += 1) {
    t.tick(1);
    add = t.last('g', 'cust');
  }
  assert.equal(add.op, 'add');
  const c = add.customer;
  t.room._state().chest[c.request.recipeId] = 1;
  const before = t.room._state().gold;
  t.say('g', { t: 'intent', n: 4, intent: { type: 'sell', recipeId: c.request.recipeId, customerId: c.id, gold: 1e9 } });
  assert.equal(t.last('g', 'ack').ok, true);
  assert.equal(t.room._state().gold, before + c.request.gold);
  const leave = t.last('h', 'cust');
  assert.equal(leave.op, 'leave');
  assert.equal(leave.reason, 'sold');
});

test('room state survives a save and reload (Durable Object eviction)', () => {
  const t = setup();
  hostAndGuest(t);
  const data = JSON.parse(JSON.stringify(t.room.toJSON()));
  const again = createRoomCore({ code: 'ABC234', now: t.clock.now, randomBytes: rb });
  again.load(data);
  assert.equal(again.exists(), true);
  assert.equal(again._state().gold, 500);
  assert.equal(again.playerCount(), 2);
});

test('gather activity is relayed to the others and cleared by a move', () => {
  const t = setup();
  hostAndGuest(t);
  t.say('g', { t: 'act', mode: 'chop', yaw: 1.25 });
  const act = t.last('h', 'act');
  assert.deepEqual({ mode: act.mode, yaw: act.yaw }, { mode: 'chop', yaw: 1.25 });
  t.open('late');
  t.say('late', { t: 'hello', name: 'Ana' });
  assert.equal(t.last('late', 'join_ok').players.find((p) => p.name === 'Sam').act.mode, 'chop');
  t.say('g', { t: 'act', mode: 'dance' });
  assert.equal(t.last('h', 'act').mode, null);
  t.say('g', { t: 'act', mode: 'mine' });
  t.say('g', { t: 'move', x: 1, z: 1 });
  assert.equal(t.room._players().get(t.last('g', 'join_ok').you.id).act, null);
});

test('hero hires are validated by the room and shared; fountain fills are rate limited', () => {
  const t = setup();
  hostAndGuest(t);
  t.room._state().gold = 100000;
  t.say('g', { t: 'intent', n: 7, intent: { type: 'hireHero', classId: 'nope', npcId: 'x' } });
  assert.equal(t.last('g', 'ack').ok, false);
  t.say('g', { t: 'intent', n: 10, intent: { type: 'hireHero', classId: 'adventurer', npcId: 'buyer-adventurer-bob' } });
  assert.equal(t.last('g', 'ack').ok, true);
  const patch = t.last('h', 'patch');
  assert.equal(patch.set.gold, 50000);
  assert.equal(patch.set.hq.heroes.adventurer.npcId, 'buyer-adventurer-bob');
  assert.equal('lastSeenAt' in patch.set.hq, false);
  t.say('g', { t: 'intent', n: 8, intent: { type: 'gather', mode: 'water' } });
  assert.equal(t.last('g', 'ack').ok, true);
  t.say('g', { t: 'intent', n: 9, intent: { type: 'gather', mode: 'water' } });
  assert.equal(t.last('g', 'ack').reason, 'too-fast');
});
