// The co-op client against an in-process room (no wrangler, no browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes as nodeRandom } from 'node:crypto';
import { createNet } from './net.js';
import { createRoomCore } from './roomCore.js';
import { createState } from '../game/economy.js';
import { createIntentBus } from '../game/intents.js';
import { AUTOSAVE_KEY, writeAutosave } from '../game/autosave.js';

const rb = (n) => new Uint8Array(nodeRandom(n));
const tick = () => new Promise((r) => setTimeout(r, 5));
async function until(fn, ms = 2000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await tick();
  }
  throw new Error('condition not met');
}

function makeServer() {
  const rooms = new Map();
  const sockets = new Map();
  let serial = 0;
  const route = (room, outs) => {
    for (const o of outs) {
      if (o.close) {
        sockets.get(o.close)?._serverClose(o.code);
        continue;
      }
      const ids = o.to === 'all' ? [...sockets.keys()].filter((id) => id !== o.except && sockets.get(id).room === room) : [o.to];
      for (const id of ids) sockets.get(id)?._deliver(JSON.stringify(o.msg));
    }
  };
  class FakeWS {
    constructor(url) {
      this.id = `c${(serial += 1)}`;
      this.readyState = 0;
      const code = url.split('/').pop();
      this.room = rooms.get(code);
      sockets.set(this.id, this);
      setTimeout(() => {
        if (!this.room?.exists()) {
          this.readyState = 1;
          this.onopen?.();
          this._deliver(JSON.stringify({ t: 'join_error', reason: 'not_found' }));
          this._serverClose(4003);
          return;
        }
        this.readyState = 1;
        route(this.room, this.room.connect(this.id, 'local'));
        this.onopen?.();
      }, 1);
    }
    send(text) {
      setTimeout(() => this.readyState === 1 && route(this.room, this.room.message(this.id, text)), 1);
    }
    // One ordered queue per socket, like a real connection: messages, then the close.
    _push(fn) {
      (this.q ??= []).push(fn);
      if (this.q.length === 1) setTimeout(() => this._drain(), 1);
    }
    _drain() {
      while (this.q.length) this.q.shift()();
    }
    _deliver(data) {
      this._push(() => this.onmessage?.({ data }));
    }
    _gone(code) {
      if (this.readyState === 3) return;
      this.readyState = 3;
      sockets.delete(this.id);
      if (this.room?.exists()) route(this.room, this.room.disconnect(this.id));
      this._push(() => this.onclose?.({ code }));
    }
    _serverClose(code) {
      this._gone(code);
    }
    close() {
      // Like a browser: messages already sent go out before the close frame.
      setTimeout(() => this._gone(1000), 2);
    }
    drop() {
      this._gone(1006);
    }
  }
  const fetch = async () => {
    const code = `R${'ABCDEFGH'[rooms.size % 8]}2345`;
    const room = createRoomCore({ code, randomBytes: rb });
    const hostKey = 'k'.repeat(20);
    room.claim(hostKey);
    rooms.set(code, room);
    return { ok: true, status: 201, json: async () => ({ code, hostKey }) };
  };
  return { FakeWS, fetch, rooms, sockets };
}

function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

function makeClient(server, gold) {
  const state = createState();
  state.gold = gold;
  const store = memStore();
  const bus = createIntentBus();
  bus.bind(state);
  let paused = false;
  const autosave = {
    saveNow: () => (paused ? false : writeAutosave(state, performance.now() / 1000, store)),
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
    },
    get paused() {
      return paused;
    },
  };
  const keepers = new Set();
  const world = {
    authority: 'local',
    customers: new Map(),
    setCustomerAuthority(m) {
      this.authority = m;
      this.customers.clear();
    },
    spawnRemoteCustomer(c) {
      this.customers.set(c.id, c);
    },
    removeRemoteCustomer(id) {
      this.customers.delete(id);
    },
    remoteKeepers: { add: (p) => keepers.add(p.id), remove: (id) => keepers.delete(id), moveTo() {}, clear: () => keepers.clear() },
    onLocalMove(fn) {
      this.move = fn;
    },
    getLocalKeeperPose: () => ({ x: 0, z: 1, scene: 'shop' }),
  };
  const hud = { refreshAll() {}, render() {}, paintCrafts() {} };
  const events = [];
  const net = createNet({
    state, world, hud, autosave, store, session: memStore(), bus,
    url: 'http://test', WebSocket: server.FakeWS, fetch: server.fetch,
    setTimeout: (f) => setTimeout(f, 3), setInterval: () => 0, clearInterval() {},
  });
  net.on('*', (type, payload) => events.push({ type, ...payload }));
  autosave.saveNow();
  return { state, net, bus, world, events, keepers, store, autosave, seen: (t) => events.find((e) => e.type === t) };
}

async function party() {
  const server = makeServer();
  const host = makeClient(server, 500);
  const guest = makeClient(server, 77);
  await host.net.createRoom('Luke');
  await until(() => host.net.status === 'hosting');
  guest.net.joinRoom(host.net.code.toLowerCase(), 'Sam');
  await until(() => guest.net.status === "in_game");
  return { server, host, guest };
}

test('host creates, guest joins and sees the host shop', async () => {
  const { host, guest } = await party();
  assert.equal(host.seen('room_created').code, host.net.code);
  assert.equal(guest.state.gold, 500, 'guest plays on the host save');
  assert.equal(guest.world.authority, 'remote');
  assert.ok(guest.keepers.size === 1 && host.keepers.size === 1);
  assert.equal(guest.autosave.paused, true, 'guest solo save is left alone');
  assert.deepEqual(guest.seen('join_ok').players.map((p) => p.color), ['red', 'blue']);
  assert.equal(host.seen('player_joined').name, 'Sam');
});

test('a guest action updates the host through the room', async () => {
  const { host, guest } = await party();
  const value = guest.bus.run({ type: 'restock', materialId: 'hide' });
  assert.ok(value);
  await until(() => host.state.gold < 500);
  assert.equal(host.state.gold, guest.state.gold);
  assert.equal(guest.bus.apply({ type: 'cheat', code: 'motherlode' }).reason, 'cheats-off');
});

test('the guest gets their solo shop back when the host ends the party', async () => {
  const { host, guest } = await party();
  host.net.endRoom();
  assert.equal(host.net.status, 'solo');
  await until(() => guest.net.status === 'ended');
  assert.equal(guest.seen('room_ended').reason, 'host_ended');
  assert.equal(guest.state.gold, 77);
  assert.equal(guest.autosave.paused, false);
  assert.equal(guest.world.authority, 'local');
  assert.equal(JSON.parse(guest.store.getItem(AUTOSAVE_KEY)).gold, 77);
  guest.net.reset();
  assert.equal(guest.net.status, 'solo');
});

test('a dropped guest reconnects automatically', async () => {
  const { server, host, guest } = await party();
  const sock = [...server.sockets.values()].at(-1);
  sock.drop();
  await until(() => guest.seen('reconnected'));
  assert.ok(guest.seen('connection_lost'));
  assert.deepEqual(guest.events.find((e) => e.type === 'reconnect_attempt'), { type: 'reconnect_attempt', n: 1, max: 5 });
  assert.equal(guest.net.status, 'in_game');
  await until(() => host.seen('player_reconnected'));
});

test('the host sees host_waiting on guests when it drops', async () => {
  const { server, host, guest } = await party();
  const hostSock = [...server.sockets.values()][0];
  hostSock.drop();
  await until(() => guest.seen('host_waiting'));
  assert.equal(guest.seen('host_waiting').secondsLeft, 120);
  await until(() => host.seen('reconnected'));
  await until(() => guest.seen('player_reconnected'));
});

test('bad codes and names are caught before connecting; unknown codes come back not_found', async () => {
  const server = makeServer();
  const c = makeClient(server, 10);
  c.net.joinRoom('AB1', 'Sam');
  assert.equal(c.seen('join_error').reason, 'bad_code');
  c.events.length = 0;
  c.net.joinRoom('ABCDEF', '<b>');
  assert.equal(c.seen('join_error').reason, 'bad_name');
  c.events.length = 0;
  c.net.joinRoom('ABCDEF', 'Sam');
  await until(() => c.seen('join_error'));
  assert.equal(c.seen('join_error').reason, 'not_found');
  assert.equal(c.net.status, 'solo');
  assert.equal(c.autosave.paused, false);
});

test('a kicked guest is told and goes back to solo', async () => {
  const { host, guest } = await party();
  host.net.kick(guest.net.you.id);
  await until(() => guest.net.status === 'ended');
  assert.equal(guest.seen('room_ended').reason, 'kicked');
  assert.equal(guest.state.gold, 77);
  await until(() => host.seen('player_left'));
});
