/**
 * Co-op room server: a Cloudflare Worker with two Durable Objects.
 *  - CoopRoom: one per invite code. Wraps src/coop/roomCore.js (the rules).
 *  - JoinGate: one global instance that throttles bad join attempts per IP.
 *
 * Routes
 *  POST /api/rooms                 -> { code, hostKey }  (the "Create invite code" action)
 *  GET  /parties/coop-room/:CODE   -> WebSocket into the room
 *  GET  /health                    -> "ok"
 *
 * Env vars: ALLOWED_ORIGINS, ROOM_MAX_PLAYERS, ROOM_IDLE_TTL_SECONDS.
 */
import { DurableObject } from 'cloudflare:workers';
import { Server, getServerByName, routePartykitRequest } from 'partyserver';
import { createRoomCore } from '../../src/coop/roomCore.js';
import {
  BAD_JOIN_LIMIT,
  BAD_JOIN_LOCK_SECONDS,
  BAD_JOIN_WINDOW_SECONDS,
  CLOSE,
  PING_EVERY_MS,
  isValidCode,
  makeCode,
} from '../../src/coop/protocol.js';

const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const CREATE_LIMIT_PER_MINUTE = 10;
const PERSIST_EVERY_MS = 10000;

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function originOk(req, env) {
  const origin = req.headers.get('Origin');
  if (!origin) return true; // Non-browser clients can't be stopped by Origin anyway.
  const list = allowedOrigins(env);
  return list.includes('*') || list.includes(origin);
}

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin');
  if (!origin || !originOk(req, env)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

const json = (body, status, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', ...headers },
});

const clientIp = (req) => req.headers.get('CF-Connecting-IP') || 'local';

/** Answer a WebSocket upgrade with a join_error and close it, so the client sees a reason. */
function rejectSocket(reason, extra = {}) {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  server.send(JSON.stringify({ t: 'join_error', reason, ...extra }));
  server.close(CLOSE.JOIN_ERROR, reason);
  return new Response(null, { status: 101, webSocket: client });
}

export class CoopRoom extends Server {
  static options = { hibernate: false };

  async onStart() {
    this.core = createRoomCore({
      code: this.name,
      randomBytes,
      maxPlayers: Number(this.env.ROOM_MAX_PLAYERS) || 4,
      idleTtl: Number(this.env.ROOM_IDLE_TTL_SECONDS) || 900,
    });
    const saved = await this.ctx.storage.get('room');
    if (saved) this.core.load(saved);
    this.timer = null;
    this.lastPersist = Date.now();
    this.lastPing = 0;
  }

  async claim(hostKey) {
    const ok = this.core.claim(hostKey);
    if (ok) {
      await this.persist(true);
      await this.scheduleWake();
    }
    return ok;
  }

  async exists() {
    return this.core.exists();
  }

  route(outs) {
    for (const o of outs) {
      if (o.close) {
        try {
          this.getConnection(o.close)?.close(o.code, o.reason);
        } catch {
          /* already closed */
        }
        continue;
      }
      const text = JSON.stringify(o.msg);
      if (o.to === 'all') this.broadcast(text, o.except ? [o.except] : undefined);
      else {
        try {
          this.getConnection(o.to)?.send(text);
        } catch {
          /* gone */
        }
      }
    }
    if (this.core.ended) this.finish();
  }

  startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => this.onTick(), 1000);
  }

  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  onTick() {
    this.route(this.core.tick());
    const now = Date.now();
    if (now - this.lastPing >= PING_EVERY_MS) {
      this.lastPing = now;
      const pings = this.core.pings();
      if (pings) this.broadcast(JSON.stringify(pings));
    }
    if (now - this.lastPersist >= PERSIST_EVERY_MS) this.persist(false);
  }

  async persist(force) {
    if (!this.core || this.core.ended) return;
    // Shared state changes every tick (materials, crafts), so the slow timer always saves.
    this.core.takeDirty();
    this.lastPersist = Date.now();
    await this.ctx.storage.put('room', JSON.parse(JSON.stringify(this.core.toJSON())));
  }

  async scheduleWake() {
    const s = this.core.wakeIn();
    if (s != null) await this.ctx.storage.setAlarm(Date.now() + s * 1000);
  }

  async finish() {
    if (this.finishing) return;
    this.finishing = true;
    this.stopTimer();
    // The room is over: forget it so the code can never be reused by this room.
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  onConnect(conn, ctx) {
    this.route(this.core.connect(conn.id, clientIp(ctx.request)));
    this.startTimer();
  }

  onMessage(conn, message) {
    this.route(this.core.message(conn.id, typeof message === 'string' ? message : ''));
  }

  async onClose(conn) {
    this.route(this.core.disconnect(conn.id));
    if (this.core.connectionCount() === 0) {
      this.stopTimer();
      await this.persist(true);
      await this.scheduleWake();
    }
  }

  onError(conn) {
    this.route(this.core.disconnect(conn.id));
  }

  async onAlarm() {
    if (!this.core) return;
    this.route(this.core.tick());
    if (this.core.ended) return;
    if (this.core.connectionCount() === 0) await this.scheduleWake();
  }
}

/** Global join throttle. Memory only: a restart forgets locks, which is fine for a prototype. */
export class JoinGate extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.bad = new Map(); // ip -> { times: [], lockedUntil }
    this.creates = new Map(); // ip -> [times]
  }

  entry(ip) {
    let e = this.bad.get(ip);
    if (!e) {
      e = { times: [], lockedUntil: 0 };
      this.bad.set(ip, e);
    }
    return e;
  }

  check(ip) {
    const e = this.bad.get(ip);
    const now = Date.now();
    if (e && e.lockedUntil > now) return { locked: true, retryAfter: Math.ceil((e.lockedUntil - now) / 1000) };
    return { locked: false, retryAfter: 0 };
  }

  recordBad(ip) {
    const e = this.entry(ip);
    const now = Date.now();
    e.times = e.times.filter((t) => now - t < BAD_JOIN_WINDOW_SECONDS * 1000);
    e.times.push(now);
    if (e.times.length >= BAD_JOIN_LIMIT) {
      e.lockedUntil = now + BAD_JOIN_LOCK_SECONDS * 1000;
      e.times = [];
    }
    return this.check(ip);
  }

  allowCreate(ip) {
    const now = Date.now();
    const list = (this.creates.get(ip) ?? []).filter((t) => now - t < 60000);
    if (list.length >= CREATE_LIMIT_PER_MINUTE) {
      this.creates.set(ip, list);
      return { ok: false, retryAfter: Math.ceil((60000 - (now - list[0])) / 1000) };
    }
    list.push(now);
    this.creates.set(ip, list);
    return { ok: true, retryAfter: 0 };
  }
}

const gate = (env) => env.JoinGate.get(env.JoinGate.idFromName('global'));

async function createRoom(req, env) {
  const ip = clientIp(req);
  const allowed = await gate(env).allowCreate(ip);
  if (!allowed.ok) return json({ error: 'rate_limited', retryAfter: allowed.retryAfter }, 429, corsHeaders(req, env));
  for (let i = 0; i < 6; i += 1) {
    const code = makeCode(randomBytes);
    const hostKey = toHex(randomBytes(18));
    const stub = await getServerByName(env.CoopRoom, code);
    if (await stub.claim(hostKey)) return json({ code, hostKey }, 201, corsHeaders(req, env));
  }
  return json({ error: 'busy' }, 503, corsHeaders(req, env));
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!originOk(req, env)) return new Response('origin not allowed', { status: 403 });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, env) });
    if (url.pathname === '/health') return new Response('ok', { headers: corsHeaders(req, env) });
    if (url.pathname === '/api/rooms' && req.method === 'POST') return createRoom(req, env);

    const routed = await routePartykitRequest(req, env, {
      onBeforeConnect: async (request, lobby) => {
        const ip = clientIp(request);
        const g = gate(env);
        const lock = await g.check(ip);
        if (lock.locked) return rejectSocket('rate_limited', { retryAfter: lock.retryAfter });
        const code = lobby.name;
        if (!isValidCode(code)) {
          const after = await g.recordBad(ip);
          return rejectSocket('bad_code', after.locked ? { retryAfter: after.retryAfter } : {});
        }
        const stub = await getServerByName(env.CoopRoom, code);
        if (!(await stub.exists())) {
          const after = await g.recordBad(ip);
          return rejectSocket('not_found', after.locked ? { retryAfter: after.retryAfter } : {});
        }
        return undefined;
      },
      onBeforeRequest: () => new Response('not found', { status: 404 }),
    });
    return routed ?? new Response('not found', { status: 404 });
  },
};
