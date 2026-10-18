// End-to-end: starts `wrangler dev` locally (no Cloudflare account) and drives
// up to 5 WebSocket clients through the co-op room flows.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import WebSocket from 'ws';

const PORT = Number(process.env.COOP_TEST_PORT || 8797);
const HTTP = `http://127.0.0.1:${PORT}`;
const WS = `ws://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:5173';
let proc;
let persistDir;

before(async () => {
  persistDir = mkdtempSync(joinPath(tmpdir(), 'coop-test-'));
  proc = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', persistDir], {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let log = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`wrangler did not start:\n${log}`)), 60000);
    const onData = (d) => {
      log += d;
      if (log.includes('Ready on')) {
        clearTimeout(timer);
        resolve();
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('exit', (c) => { clearTimeout(timer); reject(new Error(`wrangler exited ${c}:\n${log}`)); });
  });
});

after(() => {
  try {
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    /* gone */
  }
  rmSync(persistDir, { recursive: true, force: true });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createRoom() {
  const res = await fetch(`${HTTP}/api/rooms`, { method: 'POST', headers: { Origin: ORIGIN } });
  assert.equal(res.status, 201);
  return res.json();
}

class Client {
  constructor(code) {
    this.msgs = [];
    this.waiters = [];
    this.closed = null;
    this.ws = new WebSocket(`${WS}/parties/coop-room/${code}`, { headers: { Origin: ORIGIN } });
    this.ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      this.msgs.push(m);
      this.flush();
    });
    this.ws.on('close', (code, reason) => {
      this.closed = { code, reason: String(reason) };
      this.flush();
    });
    this.ws.on('error', () => {});
    this.opened = new Promise((resolve) => {
      this.ws.on('open', resolve);
      this.ws.on('close', resolve);
    });
  }

  flush() {
    this.waiters = this.waiters.filter((w) => {
      const hit = w.type === 'close' ? this.closed : this.msgs.find((m, i) => i >= w.from && m.t === w.type && w.pred(m));
      if (hit) w.resolve(hit);
      return !hit;
    });
  }

  /** Wait for a message of type t (seen at any point, unless fresh=true). */
  wait(type, pred = () => true, { fresh = false, ms = 8000 } = {}) {
    return new Promise((resolve, reject) => {
      const w = { type, pred, resolve, from: fresh ? this.msgs.length : 0 };
      this.waiters.push(w);
      this.flush();
      setTimeout(() => reject(new Error(`timeout waiting for ${type}; got ${this.msgs.map((m) => m.t).join(',')}`)), ms);
    });
  }

  async send(msg) {
    await this.opened;
    this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.ws.close();
  }
}

async function hostRoom(name = 'Luke', save) {
  const { code, hostKey } = await createRoom();
  const host = new Client(code);
  await host.send({ t: 'hello', v: 1, name, hostKey, save });
  const ok = await host.wait('join_ok');
  return { code, host, ok };
}

async function join(code, name, token) {
  const c = new Client(code);
  await c.send({ t: 'hello', v: 1, name, token });
  return c;
}

test('create a code, 3 guests join, the 5th is refused', async () => {
  const { code, host, ok } = await hostRoom();
  assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  assert.equal(ok.you.color, 'red');
  const guests = [];
  for (const name of ['Sam', 'Ana', 'Sam']) {
    const g = await join(code, name);
    await g.wait('join_ok');
    guests.push(g);
  }
  const last = guests[2].msgs.find((m) => m.t === 'join_ok');
  assert.deepEqual(last.players.map((p) => p.color), ['red', 'blue', 'green', 'purple']);
  assert.equal(last.you.name, 'Sam (2)');
  await host.wait('player_joined', (m) => m.player.name === 'Sam (2)');
  const fifth = await join(code, 'Eve');
  assert.equal((await fifth.wait('join_error')).reason, 'room_full');
  assert.equal((await fifth.wait('close')).code, 4003);
  for (const c of [host, ...guests]) c.close();
});

test('a guest action changes the shared gold for everyone', async () => {
  const { code, host, ok } = await hostRoom();
  const gold = ok.snapshot.shared.gold;
  const g = await join(code, 'Sam');
  await g.wait('join_ok');
  await g.send({ t: 'intent', n: 1, intent: { type: 'restock', materialId: 'hide' } });
  assert.equal((await g.wait('ack', (m) => m.n === 1)).ok, true);
  const patch = await host.wait('patch', (m) => m.set?.gold != null && m.set.gold < gold);
  const g2 = await join(code, 'Ana');
  const late = await g2.wait('join_ok');
  assert.equal(late.snapshot.shared.gold, patch.set.gold, 'late joiner gets the current snapshot');
  await g.send({ t: 'intent', n: 2, intent: { type: 'cheat', code: 'motherlode' } });
  assert.equal((await g.wait('ack', (m) => m.n === 2)).reason, 'cheats-off');
  for (const c of [host, g, g2]) c.close();
});

test('pings arrive about every 2 seconds', async () => {
  const { host } = await hostRoom();
  await host.send({ t: 'ping', c: Date.now() });
  await host.wait('pong');
  const pings = await host.wait('pings', (m) => m.list?.length === 1, { ms: 5000 });
  assert.ok(pings);
  host.close();
});

test('a dropped guest reconnects with the token and keeps the slot', async () => {
  const { code, host } = await hostRoom();
  const g = await join(code, 'Sam');
  const { you } = await g.wait('join_ok');
  g.ws.terminate();
  await host.wait('player_dropped', (m) => m.player.id === you.id);
  await sleep(500);
  const back = await join(code, 'Sam', you.token);
  const ok = await back.wait('join_ok');
  assert.equal(ok.you.id, you.id);
  assert.equal(ok.you.color, 'blue');
  await host.wait('player_reconnected', (m) => m.player.id === you.id);
  host.close();
  back.close();
});

test('a kicked guest is banned from that room', async () => {
  const { code, host } = await hostRoom();
  const g = await join(code, 'Sam');
  const { you } = await g.wait('join_ok');
  await host.send({ t: 'kick', id: you.id });
  assert.equal((await g.wait('room_ended')).reason, 'kicked');
  assert.equal((await g.wait('close')).code, 4001);
  await host.wait('player_left', (m) => m.player.id === you.id);
  const again = await join(code, 'Sam', you.token);
  assert.equal((await again.wait('join_error')).reason, 'kicked');
  host.close();
});

test('host drop shows host_waiting and pauses actions; host comes back', async () => {
  const { code, host, ok } = await hostRoom();
  const g = await join(code, 'Sam');
  await g.wait('join_ok');
  host.ws.terminate();
  assert.equal((await g.wait('host_waiting')).secondsLeft, 120);
  await g.send({ t: 'intent', n: 5, intent: { type: 'restock', materialId: 'hide' } });
  assert.equal((await g.wait('ack', (m) => m.n === 5)).reason, 'paused');
  const back = await join(code, 'Luke', ok.you.token);
  assert.equal((await back.wait('join_ok')).you.host, true);
  await g.wait('player_reconnected', (m) => m.player.host);
  back.close();
  g.close();
});

test('host leaving ends the room at once for everyone', async () => {
  const { code, host } = await hostRoom();
  const g1 = await join(code, 'Sam');
  const g2 = await join(code, 'Ana');
  await g1.wait('join_ok');
  await g2.wait('join_ok');
  await host.send({ t: 'leave' });
  for (const g of [g1, g2]) {
    assert.equal((await g.wait('room_ended')).reason, 'host_ended');
    assert.equal((await g.wait('close')).code, 4000);
  }
  await sleep(300);
  const late = await join(code, 'Kim');
  assert.equal((await late.wait('join_error')).reason, 'not_found');
});

// Must run last: it locks the local IP out of joining for 60 seconds.
test('bad codes are refused and 5 bad tries lock joining with retryAfter', async () => {
  const bad = await join('ZZ1', 'Sam');
  assert.equal((await bad.wait('join_error')).reason, 'bad_code');
  const results = [];
  for (let i = 0; i < 5; i += 1) {
    const c = await join('ZZZZZ2', 'Sam');
    results.push(await c.wait('join_error'));
  }
  const locked = results.find((r) => r.reason === 'rate_limited') ?? results.at(-1);
  assert.ok(locked.retryAfter > 0 && locked.retryAfter <= 60, JSON.stringify(results));
  const after = await join('ZZZZZ3', 'Sam');
  const err = await after.wait('join_error');
  assert.equal(err.reason, 'rate_limited');
  assert.ok(err.retryAfter > 0);
});
