/**
 * One co-op room, without any networking. The Durable Object in party/
 * feeds it connections and messages and sends what it returns, so the
 * whole room can be unit tested in Node.
 *
 * Rules (agreed with Luke and Youi):
 * - The game always runs on the host's save. Guests drop in any time a slot
 *   is free; there is no lobby, start or ready step.
 * - Slots and colours: host is slot 1 (red), then blue, green, purple.
 * - No host migration. Host drops: hold 2 min (host_waiting), then end with
 *   host_left. Host leaves or ends: end at once with host_ended.
 * - Guest drops: slot held 2 min for a reconnect with the same token.
 * - Kicked players are banned from the room.
 * - Cheats are off; every intent is checked with the shared economy rules.
 */
import { createState, applyState, completeCrafts, tickMaterials } from '../game/economy.js';
import { RECIPES, MATERIALS } from '../game/catalog.js';
import { restoreCrafts } from '../game/autosave.js';
import { applyIntent } from '../game/intents.js';
import { createCustomerRoom } from '../game/customerSim.js';
import { defaultRng } from '../game/rng.js';
import { createDiffer, craftsView, sharedView } from './sharedState.js';
import {
  CLOSE,
  COLORS,
  DEFAULT_NAME,
  HOLD_SECONDS,
  MAX_HELLO_BYTES,
  MAX_MESSAGE_BYTES,
  MAX_PLAYERS,
  PROTOCOL_VERSION,
  RATE_BURST,
  RATE_PER_SECOND,
  cleanName,
  uniqueName,
} from './protocol.js';

const HELLO_TIMEOUT = 10;
const HOST_WAIT_NOTICE_EVERY = 15;
const ABUSE_DROPS = 60;

function hex(randomBytes, n) {
  return [...randomBytes(n)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

export function createRoomCore({
  code,
  now = () => Date.now() / 1000,
  rng = defaultRng,
  randomBytes,
  maxPlayers = MAX_PLAYERS,
  idleTtl = 900,
} = {}) {
  if (typeof randomBytes !== 'function') throw new Error('randomBytes is required');
  const max = Math.max(1, Math.min(MAX_PLAYERS, Math.round(Number(maxPlayers) || MAX_PLAYERS)));
  const ttl = Math.max(30, Number(idleTtl) || 900);

  let meta = null; // { code, hostKey, createdAt, started, ended, hostId }
  let state = null;
  let customers = createCustomerRoom({ rng, now: now() });
  const gatherLog = new Map();
  const players = new Map(); // id -> player
  const banned = new Set(); // tokens
  const conns = new Map(); // connId -> { playerId, ip, bucket, last, drops, openedAt }
  const differ = createDiffer();
  let lastTick = null;
  let lastHostNotice = -Infinity;
  let dirty = false;

  const out = [];
  const send = (to, msg) => out.push({ to, msg });
  const broadcast = (msg, except = null) => out.push({ to: 'all', except, msg });
  const close = (connId, code, reason) => out.push({ close: connId, code, reason });
  function flush() {
    const list = out.splice(0, out.length);
    return list;
  }

  function publicPlayer(p) {
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      host: Boolean(p.host),
      connected: Boolean(p.connId),
      ms: p.ms ?? null,
      pos: p.pos ?? null,
    };
  }
  const playerList = () => [...players.values()].sort((a, b) => a.slot - b.slot).map(publicPlayer);
  const host = () => [...players.values()].find((p) => p.host) ?? null;

  function freeSlot() {
    const used = new Set([...players.values()].map((p) => p.slot));
    for (let i = 0; i < max; i += 1) if (!used.has(i)) return i;
    return -1;
  }

  function snapshot() {
    const t = now();
    return {
      shared: sharedView(state),
      crafts: craftsView(state),
      customers: customers.list(),
      serverNow: t,
    };
  }

  function end(reason) {
    if (!meta || meta.ended) return;
    meta.ended = reason;
    broadcast({ t: 'room_ended', reason });
    for (const [connId] of conns) close(connId, CLOSE.ENDED, reason);
    dirty = true;
  }

  function joinError(connId, reason, extra = {}) {
    send(connId, { t: 'join_error', reason, ...extra });
    close(connId, CLOSE.JOIN_ERROR, reason);
  }

  function attach(connId, player, kind) {
    const conn = conns.get(connId);
    if (player.connId && player.connId !== connId) {
      close(player.connId, CLOSE.REPLACED, 'replaced');
      const old = conns.get(player.connId);
      if (old) old.playerId = null;
    }
    player.connId = connId;
    player.disconnectedAt = null;
    conn.playerId = player.id;
    if (conn.ip) player.ip = conn.ip;
    send(connId, {
      t: 'join_ok',
      v: PROTOCOL_VERSION,
      code: meta.code,
      you: { ...publicPlayer(player), token: player.token },
      players: playerList(),
      snapshot: snapshot(),
    });
    const pub = publicPlayer(player);
    if (kind === 'joined') broadcast({ t: 'player_joined', player: pub }, connId);
    if (kind === 'reconnected') broadcast({ t: 'player_reconnected', player: pub }, connId);
    dirty = true;
  }

  function handleHello(connId, msg, rawLength) {
    const conn = conns.get(connId);
    if (conn.playerId) return;
    if (!meta || meta.ended) return joinError(connId, 'not_found');
    if (rawLength > MAX_HELLO_BYTES) return joinError(connId, 'bad_name');
    const token = typeof msg.token === 'string' && msg.token.length <= 96 ? msg.token : null;
    if (token && banned.has(token)) return joinError(connId, 'kicked');
    if (conn.ip && meta.bannedIps?.includes(conn.ip)) return joinError(connId, 'kicked');

    // Reconnect with a held slot.
    if (token) {
      const held = [...players.values()].find((p) => p.token === token);
      if (held) return attach(connId, held, 'reconnected');
    }

    // First host connect: needs the key from room creation, brings the save.
    const isHost = !meta.started && typeof msg.hostKey === 'string' && msg.hostKey === meta.hostKey;
    if (!meta.started && !isHost) return joinError(connId, 'not_found');

    const name = cleanName(typeof msg.name === 'string' ? msg.name : DEFAULT_NAME);
    if (!name) return joinError(connId, 'bad_name');
    if (players.size >= max) return joinError(connId, 'room_full');
    const slot = freeSlot();
    if (slot < 0) return joinError(connId, 'room_full');

    if (isHost) {
      state = createState();
      if (msg.save && typeof msg.save === 'object') {
        applyState(state, msg.save);
        restoreCrafts(state, msg.save.autosaveCrafts, now());
      }
      state.log = [];
      customers = createCustomerRoom({ rng, now: now() });
      differ.diff(state, { force: true });
      meta.started = true;
      lastTick = now();
    }
    const player = {
      id: `p${hex(randomBytes, 4)}`,
      token: hex(randomBytes, 18),
      name: uniqueName(name, [...players.values()].map((p) => p.name)),
      color: COLORS[slot],
      slot,
      host: isHost,
      connId: null,
      disconnectedAt: null,
      ms: null,
      pos: null,
      joinedAt: now(),
    };
    players.set(player.id, player);
    if (isHost) meta.hostId = player.id;
    attach(connId, player, 'joined');
  }

  function removePlayer(player, why) {
    players.delete(player.id);
    for (const key of [...gatherLog.keys()]) if (key.startsWith(`${player.id}:`)) gatherLog.delete(key);
    broadcast({ t: 'player_left', player: publicPlayer(player), why });
    dirty = true;
  }

  function hostWaiting() {
    const h = host();
    return Boolean(h && !h.connId);
  }

  const EVT_TEXT = {
    sell: (p, i, r) => `${p.name} sold ${RECIPES[i.recipeId]?.name ?? 'a ware'} for ${r.value}g.`,
    buyFromCustomer: (p, i) => `${p.name} bought ${MATERIALS[i.materialId]?.name ?? 'a material'}.`,
    craft: (p, i, r) => `${p.name} started ${r.value > 1 ? `${r.value}× ` : ''}${RECIPES[i.recipeId]?.name ?? 'a craft'}.`,
    upgradeChest: (p) => `${p.name} upgraded the chest.`,
    buyExpansion: (p) => `${p.name} opened a new room.`,
    buyStation: (p, i) => `${p.name} placed a ${i.stationId}.`,
    buyFurniture: (p, i) => `${p.name} placed a ${i.furnitureType}.`,
    refuseCustomer: (p) => `${p.name} turned a traveller away.`,
  };

  function handleIntent(connId, player, msg) {
    const n = Number.isInteger(msg.n) ? msg.n : null;
    if (hostWaiting()) {
      send(connId, { t: 'ack', n, ok: false, reason: 'paused' });
      return resync(connId);
    }
    const intent = msg.intent;
    const result = applyIntent(state, intent, {
      coop: true,
      now: now(),
      playerId: player.id,
      customers: customers.customers,
      gatherLog,
    });
    send(connId, { t: 'ack', n, ok: result.ok, reason: result.reason ?? null });
    if (!result.ok) return resync(connId);
    if (result.leave && result.customerId != null) {
      const ev = customers.remove(state, result.customerId, result.leave);
      if (ev) broadcast({ t: 'cust', ...ev, by: player.id }, connId);
    }
    const text = EVT_TEXT[intent.type]?.(player, intent, result);
    if (text) broadcast({ t: 'evt', kind: intent.type, by: player.id, text }, connId);
    pushPatch();
    dirty = true;
  }

  function resync(connId) {
    send(connId, { t: 'patch', set: { ...sharedView(state), crafts: craftsView(state) }, serverNow: now(), full: true });
  }

  function pushPatch() {
    if (!state) return;
    const set = differ.diff(state);
    if (set) broadcast({ t: 'patch', set, serverNow: now() });
  }

  function handleMessage(connId, raw) {
    const conn = conns.get(connId);
    if (!conn) return flush();
    const text = typeof raw === 'string' ? raw : '';
    const t = now();
    // Token bucket.
    conn.bucket = Math.min(RATE_BURST, conn.bucket + (t - conn.last) * RATE_PER_SECOND);
    conn.last = t;
    if (conn.bucket < 1) {
      conn.drops += 1;
      if (conn.drops >= ABUSE_DROPS) close(connId, CLOSE.ABUSE, 'rate_limited');
      else if (conn.drops % 10 === 1) send(connId, { t: 'error', reason: 'rate_limited' });
      return flush();
    }
    conn.bucket -= 1;
    conn.drops = Math.max(0, conn.drops - 0.25);
    const limit = conn.playerId ? MAX_MESSAGE_BYTES : MAX_HELLO_BYTES;
    if (text.length > limit) {
      send(connId, { t: 'error', reason: 'too_big' });
      if (!conn.playerId) close(connId, CLOSE.BAD_MESSAGE, 'too_big');
      return flush();
    }
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      send(connId, { t: 'error', reason: 'bad_json' });
      return flush();
    }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') {
      send(connId, { t: 'error', reason: 'bad_message' });
      return flush();
    }
    if (!conn.playerId) {
      if (msg.t === 'hello') handleHello(connId, msg, text.length);
      else send(connId, { t: 'error', reason: 'hello_first' });
      return flush();
    }
    const player = players.get(conn.playerId);
    if (!player || meta?.ended) return flush();
    switch (msg.t) {
      case 'intent':
        handleIntent(connId, player, msg);
        break;
      case 'move':
        if (finite(msg.x) && finite(msg.z) && Math.abs(msg.x) < 200 && Math.abs(msg.z) < 200) {
          const scene = ['shop', 'dungeon', 'runefield'].includes(msg.scene) ? msg.scene : 'shop';
          player.pos = { x: msg.x, z: msg.z, scene };
          broadcast({ t: 'move', id: player.id, x: msg.x, z: msg.z, scene }, connId);
        }
        break;
      case 'ping':
        if (finite(msg.ms) && msg.ms >= 0 && msg.ms < 60000) player.ms = Math.round(msg.ms);
        send(connId, { t: 'pong', c: finite(msg.c) ? msg.c : null, serverNow: t });
        break;
      case 'resync':
        resync(connId);
        break;
      case 'kick': {
        if (!player.host) break;
        const target = players.get(msg.id);
        if (!target || target.host) break;
        banned.add(target.token);
        if (target.ip && target.ip !== player.ip && target.ip !== 'local') {
          meta.bannedIps = [...(meta.bannedIps ?? []), target.ip].slice(-50);
        }
        if (target.connId) {
          send(target.connId, { t: 'room_ended', reason: 'kicked' });
          close(target.connId, CLOSE.KICKED, 'kicked');
          const c = conns.get(target.connId);
          if (c) c.playerId = null;
        }
        removePlayer(target, 'kicked');
        break;
      }
      case 'leave':
        if (player.host) {
          end('host_ended');
        } else {
          conn.playerId = null;
          removePlayer(player, 'left');
          close(connId, CLOSE.ENDED, 'left');
        }
        break;
      case 'end':
        if (player.host) end('host_ended');
        break;
      default:
        send(connId, { t: 'error', reason: 'unknown_type' });
    }
    return flush();
  }

  function tick() {
    const t = now();
    if (!meta || meta.ended) return flush();
    if (!meta.started) {
      if (t - meta.createdAt > ttl) end('room_closed');
      return flush();
    }
    // Hello timeouts.
    for (const [connId, conn] of conns) {
      if (!conn.playerId && t - conn.openedAt > HELLO_TIMEOUT) close(connId, CLOSE.BAD_MESSAGE, 'hello_timeout');
    }
    const h = host();
    if (!h) {
      end('host_left');
      return flush();
    }
    if (!h.connId) {
      const left = Math.max(0, Math.ceil(HOLD_SECONDS - (t - h.disconnectedAt)));
      if (left <= 0) {
        end('host_left');
        return flush();
      }
      if (t - lastHostNotice >= HOST_WAIT_NOTICE_EVERY) {
        lastHostNotice = t;
        broadcast({ t: 'host_waiting', secondsLeft: left });
      }
      lastTick = t; // The shop is paused while the host is away.
    } else {
      const dt = Math.max(0, Math.min(5, t - (lastTick ?? t)));
      lastTick = t;
      tickMaterials(state, dt);
      state.playTime = (state.playTime ?? 0) + dt;
      completeCrafts(state, t);
      for (const ev of customers.tick(state, t)) broadcast({ t: 'cust', ...ev });
      pushPatch();
    }
    for (const p of [...players.values()]) {
      if (!p.host && !p.connId && p.disconnectedAt != null && t - p.disconnectedAt >= HOLD_SECONDS) {
        removePlayer(p, 'timeout');
      }
    }
    return flush();
  }

  return {
    /** Called once by the room creator. Returns false if the code is in use. */
    claim(hostKey) {
      if (meta && !meta.ended) return false;
      meta = { code, hostKey, createdAt: now(), started: false, ended: null, hostId: null, bannedIps: [] };
      players.clear();
      banned.clear();
      state = null;
      dirty = true;
      return true;
    },
    exists() {
      return Boolean(meta && !meta.ended);
    },
    get ended() {
      return meta?.ended ?? null;
    },
    get started() {
      return Boolean(meta?.started);
    },
    connect(connId, ip = null) {
      const t = now();
      conns.set(connId, { playerId: null, ip, bucket: RATE_BURST, last: t, drops: 0, openedAt: t });
      return flush();
    },
    message: handleMessage,
    disconnect(connId) {
      const conn = conns.get(connId);
      conns.delete(connId);
      if (!conn?.playerId || meta?.ended) return flush();
      const player = players.get(conn.playerId);
      if (!player || player.connId !== connId) return flush();
      player.connId = null;
      player.disconnectedAt = now();
      player.ms = null;
      broadcast({ t: 'player_dropped', player: publicPlayer(player) });
      if (player.host) {
        lastHostNotice = now();
        broadcast({ t: 'host_waiting', secondsLeft: HOLD_SECONDS });
      }
      dirty = true;
      return flush();
    },
    tick,
    pings() {
      if (!meta?.started || meta.ended) return null;
      return { t: 'pings', list: [...players.values()].map((p) => ({ id: p.id, ms: p.connId ? p.ms : null })) };
    },
    connectionCount: () => conns.size,
    playerCount: () => players.size,
    /** Seconds until the room should next wake up when nobody is connected. */
    wakeIn() {
      if (!meta || meta.ended) return null;
      if (!meta.started) return Math.max(1, ttl - (now() - meta.createdAt));
      const h = host();
      if (h && !h.connId) return Math.max(1, HOLD_SECONDS - (now() - h.disconnectedAt) + 1);
      return HOLD_SECONDS;
    },
    takeDirty() {
      const d = dirty;
      dirty = false;
      return d;
    },
    toJSON() {
      return {
        meta,
        state: state ? { save: { ...sharedView(state), version: 11, playTime: state.playTime, kingRoaldAt: state.kingRoaldAt }, crafts: craftsView(state) } : null,
        customers: customers.toJSON(),
        players: [...players.values()].map((p) => ({ ...p, connId: null, disconnectedAt: p.disconnectedAt ?? now() })),
        banned: [...banned],
      };
    },
    load(data) {
      if (!data?.meta) return;
      meta = data.meta;
      players.clear();
      for (const p of data.players ?? []) players.set(p.id, p);
      for (const tok of data.banned ?? []) banned.add(tok);
      if (data.state?.save) {
        state = createState();
        applyState(state, data.state.save);
        state.crafts = data.state.crafts ?? {};
        state.log = [];
        differ.diff(state, { force: true });
      }
      customers = createCustomerRoom({ rng, now: now() });
      customers.load(data.customers, now());
      lastTick = now();
    },
    /** Test hook. */
    _state: () => state,
    _players: () => players,
    _customers: () => customers,
  };
}
