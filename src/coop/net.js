/**
 * Co-op client. Loaded only when the player hosts or joins (coopUi imports it
 * on demand), so solo play never opens a socket.
 *
 * UI -> Net:  createRoom(name), joinRoom(code, name), kick(id), leave(), endRoom(), reset()
 * Net -> UI:  on(event, fn) with the events listed in docs/COOP.md.
 * States:     solo, hosting, connecting, in_game, reconnecting, ended
 */
import { pushLog } from '../game/economy.js';
import { autosaveData, loadAutosave } from '../game/autosave.js';
import { intentBus } from '../game/intents.js';
import {
  CLOSE,
  DEFAULT_NAME,
  PING_EVERY_MS,
  PROTOCOL_VERSION,
  RECONNECT_DELAYS,
  cleanName,
  isValidCode,
  normalizeCode,
} from './protocol.js';
import { LAYOUT_KEYS, applySharedPatch } from './sharedState.js';

export const LAST_NAME_KEY = 'stallhaven-coop-name';
const TOKEN_KEY = (code) => `stallhaven-coop-token-${code}`;
const LIGHT_KEYS = new Set(['gold', 'materials', 'crafts', 'shopXp', 'skills', 'craftCounts']);

export function defaultServerUrl() {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  return (env?.VITE_ROOM_SERVER_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
}

export function lastName(store = globalThis.localStorage) {
  try {
    return cleanName(store?.getItem(LAST_NAME_KEY) ?? '') ?? DEFAULT_NAME;
  } catch {
    return DEFAULT_NAME;
  }
}

/**
 * deps: { state, world, hud, autosave } from the game, plus optional
 * { url, WebSocket, fetch, store, session, clock, setTimeout, clearTimeout,
 *   setInterval, clearInterval } for tests.
 */
export function createNet(deps) {
  const {
    state,
    world,
    hud,
    autosave,
    url = defaultServerUrl(),
    WebSocket: WS = globalThis.WebSocket,
    fetch: doFetch = (...a) => globalThis.fetch(...a),
    store = globalThis.localStorage,
    session = globalThis.sessionStorage,
    clock = { now: () => performance.now() / 1000 },
    bus = intentBus,
  } = deps;
  const timers = {
    setTimeout: deps.setTimeout ?? ((f, ms) => setTimeout(f, ms)),
    clearTimeout: deps.clearTimeout ?? ((id) => clearTimeout(id)),
    setInterval: deps.setInterval ?? ((f, ms) => setInterval(f, ms)),
    clearInterval: deps.clearInterval ?? ((id) => clearInterval(id)),
  };
  const wsBase = url.replace(/^http/, 'ws');
  const listeners = new Map();
  let status = 'solo';
  let ws = null;
  let code = null;
  let hostKey = null;
  let me = null;
  let players = new Map();
  let amHost = false;
  let skew = 0; // local seconds minus server seconds
  let bestRtt = Infinity;
  let lastRtt = null;
  let pingTimer = null;
  let retryTimer = null;
  let attempt = 0;
  let intentSerial = 0;
  let hostAway = false;

  const emit = (type, payload = {}) => {
    for (const fn of listeners.get(type) ?? []) {
      try {
        fn(payload);
      } catch (err) {
        console.error('[coop] listener failed', type, err);
      }
    }
    for (const fn of listeners.get('*') ?? []) fn(type, payload);
  };
  const setStatus = (next) => {
    if (status === next) return;
    status = next;
    emit('status', { status });
  };
  const safe = (fn) => {
    try {
      return fn();
    } catch {
      return null;
    }
  };
  const toLocal = (serverSeconds) => serverSeconds + skew;
  const nowLocal = () => clock.now();
  const pub = (p) => ({ id: p.id, name: p.name, color: p.color, ...(p.host ? { host: true } : {}) });

  function send(msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  function noteServerTime(serverNow, rtt = null) {
    if (!Number.isFinite(serverNow)) return;
    if (rtt != null) {
      if (rtt > bestRtt * 1.5 && bestRtt !== Infinity) return;
      bestRtt = Math.min(bestRtt, rtt);
      skew = nowLocal() - rtt / 2 - serverNow;
    } else if (bestRtt === Infinity) {
      skew = nowLocal() - serverNow;
    }
  }

  function rememberName(name) {
    safe(() => store?.setItem(LAST_NAME_KEY, name));
  }

  function refresh(keys) {
    if (!keys.length) return;
    const layout = keys.some((k) => LAYOUT_KEYS.includes(k));
    if (layout || keys.some((k) => !LIGHT_KEYS.has(k))) {
      safe(() => hud?.refreshAll?.({ layout }));
    } else {
      safe(() => hud?.paintCrafts?.());
      safe(() => hud?.render?.(nowLocal()));
    }
  }

  // ---------------------------------------------------------------- socket
  function open(hello, { reconnecting = false } = {}) {
    closeSocket();
    const socket = new WS(`${wsBase}/parties/coop-room/${code}`);
    ws = socket;
    let answered = false;
    socket.onopen = () => {
      if (ws !== socket) return;
      socket.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, ...hello }));
    };
    socket.onmessage = (ev) => {
      if (ws !== socket) return;
      let msg;
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
      } catch {
        return;
      }
      if (msg.t === 'join_ok' || msg.t === 'join_error') answered = true;
      handle(msg, { reconnecting });
    };
    socket.onclose = (ev) => {
      if (ws !== socket) return;
      ws = null;
      onSocketClosed(ev?.code ?? 1006, { answered, reconnecting });
    };
    socket.onerror = () => {};
  }

  function closeSocket(codeNum = 1000, reason = 'bye') {
    const socket = ws;
    ws = null;
    if (socket) safe(() => socket.close(codeNum, reason));
  }

  function onSocketClosed(closeCode, { answered, reconnecting }) {
    stopPing();
    if (status === 'solo' || status === 'ended') return;
    if (closeCode === CLOSE.ENDED || closeCode === CLOSE.KICKED) {
      return finish(closeCode === CLOSE.KICKED ? 'kicked' : 'room_closed');
    }
    if (closeCode === CLOSE.REPLACED) return finish('connection_lost'); // Opened in another tab.
    if (closeCode === CLOSE.JOIN_ERROR) {
      if (reconnecting) return finish('connection_lost');
      return; // join_error already handled.
    }
    if (status === 'connecting' && !answered && !reconnecting) {
      backToSolo();
      emit('join_error', { reason: 'offline' });
      return;
    }
    if (reconnecting) return scheduleRetry();
    // We were in the room and the line dropped.
    attempt = 0;
    setStatus('reconnecting');
    emit('connection_lost');
    scheduleRetry();
  }

  function scheduleRetry() {
    if (attempt >= RECONNECT_DELAYS.length) return finish('connection_lost');
    const delay = RECONNECT_DELAYS[attempt] * 1000;
    attempt += 1;
    retryTimer = timers.setTimeout(() => {
      retryTimer = null;
      if (status !== 'reconnecting') return;
      emit('reconnect_attempt', { n: attempt, max: RECONNECT_DELAYS.length });
      open({ name: me?.name ?? DEFAULT_NAME, token: me?.token }, { reconnecting: true });
    }, delay);
  }

  function startPing() {
    stopPing();
    const ping = () => send({ t: 'ping', c: nowLocal(), ms: lastRtt == null ? undefined : Math.round(lastRtt * 1000) });
    ping();
    pingTimer = timers.setInterval(ping, PING_EVERY_MS);
  }

  function stopPing() {
    if (pingTimer != null) timers.clearInterval(pingTimer);
    pingTimer = null;
  }

  // -------------------------------------------------------------- messages
  function handle(msg, { reconnecting }) {
    switch (msg.t) {
      case 'join_ok':
        return enterRoom(msg, { reconnecting });
      case 'join_error':
        if (reconnecting) return finish(msg.reason === 'kicked' ? 'kicked' : 'connection_lost');
        backToSolo();
        emit('join_error', { reason: msg.reason, ...(msg.retryAfter ? { retryAfter: msg.retryAfter } : {}) });
        return undefined;
      case 'patch': {
        noteServerTime(msg.serverNow);
        const keys = applySharedPatch(state, msg.set, toLocal);
        refresh(keys);
        return undefined;
      }
      case 'cust':
        if (msg.op === 'add') safe(() => world.spawnRemoteCustomer(msg.customer));
        else if (msg.op === 'leave') safe(() => world.removeRemoteCustomer(msg.id, msg.reason));
        return undefined;
      case 'move':
        safe(() => world.remoteKeepers?.moveTo(msg.id, msg.x, msg.z, msg.scene));
        return undefined;
      case 'evt':
        if (typeof msg.text === 'string') {
          pushLog(state, msg.text.slice(0, 160));
          safe(() => hud?.render?.(nowLocal()));
        }
        return undefined;
      case 'player_joined':
        players.set(msg.player.id, msg.player);
        safe(() => world.remoteKeepers?.add(msg.player));
        emit('player_joined', pub(msg.player));
        emit('players', { players: list() });
        return undefined;
      case 'player_left':
        players.delete(msg.player.id);
        safe(() => world.remoteKeepers?.remove(msg.player.id));
        emit('player_left', pub(msg.player));
        emit('players', { players: list() });
        return undefined;
      case 'player_dropped':
        if (players.has(msg.player.id)) players.get(msg.player.id).connected = false;
        emit('player_dropped', pub(msg.player));
        emit('ping_update', { id: msg.player.id, ms: null });
        return undefined;
      case 'player_reconnected':
        players.set(msg.player.id, { ...players.get(msg.player.id), ...msg.player, connected: true });
        if (msg.player.host) hostAway = false;
        emit('player_reconnected', pub(msg.player));
        emit('players', { players: list() });
        return undefined;
      case 'pings':
        for (const p of msg.list ?? []) {
          if (players.has(p.id)) players.get(p.id).ms = p.ms;
          emit('ping_update', { id: p.id, ms: p.ms });
        }
        return undefined;
      case 'pong':
        if (Number.isFinite(msg.c)) {
          lastRtt = Math.max(0, nowLocal() - msg.c);
          noteServerTime(msg.serverNow, lastRtt);
        }
        return undefined;
      case 'host_waiting':
        hostAway = true;
        emit('host_waiting', { secondsLeft: msg.secondsLeft });
        return undefined;
      case 'room_ended':
        return finish(msg.reason);
      case 'ack':
        if (!msg.ok) emit('rejected', { reason: msg.reason });
        return undefined;
      case 'error':
        console.warn('[coop] server said', msg.reason);
        return undefined;
      default:
        return undefined;
    }
  }

  function list() {
    return [...players.values()].map((p) => ({ ...pub(p), connected: p.connected !== false, ms: p.ms ?? null }));
  }

  function enterRoom(msg, { reconnecting }) {
    me = msg.you;
    amHost = Boolean(me.host);
    code = msg.code;
    players = new Map(msg.players.map((p) => [p.id, { ...p }]));
    safe(() => session?.setItem(TOKEN_KEY(code), me.token));
    bestRtt = Infinity;
    noteServerTime(msg.snapshot?.serverNow);
    hostAway = msg.players.some((p) => p.host && !p.connected);

    // The room's shop replaces what this browser shows.
    const keys = applySharedPatch(state, { ...msg.snapshot.shared, crafts: msg.snapshot.crafts }, toLocal);
    world.setCustomerAuthority('local'); // Clears any travellers we were showing...
    world.setCustomerAuthority('remote'); // ...then the room's travellers come in.
    for (const c of msg.snapshot.customers ?? []) safe(() => world.spawnRemoteCustomer(c));
    world.remoteKeepers?.clear();
    for (const p of msg.players) if (p.id !== me.id) safe(() => world.remoteKeepers?.add(p));
    bus.setRemote((intent) => {
      intentSerial += 1;
      send({ t: 'intent', n: intentSerial, intent });
    });
    world.onLocalMove?.((pose) => send({ t: 'move', x: pose.x, z: pose.z, scene: pose.scene }));
    refresh(keys.length ? keys : ['furniture']);
    const pose = safe(() => world.getLocalKeeperPose?.());
    if (pose) send({ t: 'move', x: pose.x, z: pose.z, scene: pose.scene });
    startPing();
    attempt = 0;

    if (reconnecting) {
      setStatus(amHost ? 'hosting' : 'in_game');
      emit('reconnected');
      emit('players', { players: list() });
      return;
    }
    setStatus(amHost ? 'hosting' : 'in_game');
    emit('join_ok', { code, you: pub(me), players: msg.players.map(pub) });
    emit('players', { players: list() });
    if (hostAway) emit('host_waiting', { secondsLeft: 120 });
  }

  // ------------------------------------------------------------- endings
  function teardownLink() {
    stopPing();
    if (retryTimer != null) timers.clearTimeout(retryTimer);
    retryTimer = null;
    closeSocket();
    bus.setRemote(null);
    safe(() => world.onLocalMove?.(null));
    safe(() => world.remoteKeepers?.clear());
    safe(() => world.setCustomerAuthority('local'));
  }

  /** Guests get their own solo save back; the host keeps playing the room's (their own) shop. */
  function restoreSolo() {
    if (!amHost && autosave) {
      safe(() => loadAutosave(state, nowLocal(), store));
      autosave.resume?.();
      safe(() => hud?.refreshAll?.({ layout: true }));
    } else {
      autosave?.resume?.();
      safe(() => autosave?.saveNow?.());
      safe(() => hud?.refreshAll?.({ layout: false }));
    }
  }

  function backToSolo() {
    teardownLink();
    if (autosave?.paused && !amHost) autosave.resume();
    me = null;
    code = null;
    players = new Map();
    setStatus('solo');
  }

  function finish(reason, { self = false } = {}) {
    if (status === 'solo' || status === 'ended') return;
    const wasHost = amHost;
    if (code) safe(() => session?.removeItem(TOKEN_KEY(code)));
    teardownLink();
    restoreSolo();
    me = null;
    code = null;
    players = new Map();
    hostAway = false;
    if (self) {
      setStatus('solo');
      emit('room_ended', { reason, self: true, host: wasHost });
      return;
    }
    setStatus('ended');
    emit('room_ended', { reason, host: wasHost });
  }

  // ----------------------------------------------------------------- API
  return {
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type)?.delete(fn);
    },
    get status() {
      return status;
    },
    get code() {
      return code;
    },
    get you() {
      return me ? pub(me) : null;
    },
    get isHost() {
      return amHost && Boolean(me);
    },
    get hostAway() {
      return hostAway;
    },
    get players() {
      return list();
    },
    toLocal,

    async createRoom(name) {
      if (status !== 'solo' && status !== 'ended') return false;
      const clean = cleanName(name ?? '') ?? DEFAULT_NAME;
      rememberName(clean);
      setStatus('connecting');
      amHost = true;
      let res;
      try {
        res = await doFetch(`${url}/api/rooms`, { method: 'POST' });
      } catch {
        res = null;
      }
      if (!res || !res.ok) {
        const body = res ? await res.json().catch(() => ({})) : {};
        amHost = false;
        setStatus('solo');
        emit('join_error', {
          reason: res?.status === 429 ? 'rate_limited' : 'offline',
          ...(body.retryAfter ? { retryAfter: body.retryAfter } : {}),
        });
        return false;
      }
      const body = await res.json();
      code = body.code;
      hostKey = body.hostKey;
      emit('room_created', { code });
      safe(() => autosave?.saveNow?.());
      open({ name: clean, hostKey, save: autosaveData(state, nowLocal()) });
      return true;
    },

    joinRoom(rawCode, name) {
      if (status !== 'solo' && status !== 'ended') return false;
      const c = normalizeCode(rawCode ?? '');
      if (!isValidCode(c)) {
        emit('join_error', { reason: 'bad_code' });
        return false;
      }
      const clean = cleanName(name ?? '');
      if (!clean) {
        emit('join_error', { reason: 'bad_name' });
        return false;
      }
      rememberName(clean);
      code = c;
      amHost = false;
      // Save the solo shop first; it stays untouched until the party ends.
      safe(() => autosave?.saveNow?.());
      autosave?.pause?.();
      setStatus('connecting');
      const token = safe(() => session?.getItem(TOKEN_KEY(c))) || undefined;
      open({ name: clean, token });
      return true;
    },

    kick(id) {
      if (amHost) send({ t: 'kick', id });
    },

    leave() {
      if (!me) {
        if (status === 'connecting' || status === 'reconnecting') backToSolo();
        return;
      }
      send({ t: 'leave' });
      finish(amHost ? 'host_ended' : 'left', { self: true });
    },

    endRoom() {
      if (!amHost || !me) return;
      send({ t: 'end' });
      finish('host_ended', { self: true });
    },

    /** "Back to my shop" on the ended screen. */
    reset() {
      if (status === 'ended') setStatus('solo');
    },

    /** Ask the room for a full copy of the shared shop. */
    resync() {
      send({ t: 'resync' });
    },
  };
}
