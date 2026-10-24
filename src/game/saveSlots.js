/**
 * Save slots (SPEC: Youi's save system draft, rev approved by Luke).
 *
 * Three named slots stored under rc-save-slot-1..3 plus rc-save-meta.
 * Backend: IndexedDB (database "stallhaven-saves", store "kv"), falling back to
 * localStorage when IndexedDB is missing or fails to open. The picker reads
 * only the meta record so it stays fast.
 *
 * Everything here is DOM-free so it can be unit tested in node with a memory
 * backend and a manual clock.
 */
import { applyState, createState, SAVE_VERSION } from './economy.js';
import { autosaveData, restoreCrafts } from './autosave.js';

export const SLOT_COUNT = 3;
export const SLOT_KEY = (n) => `rc-save-slot-${n}`;
export const META_KEY = 'rc-save-meta';
/** The co-op branch's single autosave key, migrated into slot 1 once. */
export const LEGACY_KEYS = ['stallhaven-autosave-v1', 'rc-save'];
export const AUTOSAVE_EVERY_MS = 180_000;
export const SAVING_PILL_DELAY_MS = 300;
export const OK_FADE_MS = 1500;
export const NAME_MAX = 32;
export const DEFAULT_OWNER = 'Luke';

export function isSlot(n) {
  return Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT;
}

/* ---------- names ---------- */

export function cleanSlotName(raw) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
}

/** "Shop 1", or the next free "Shop N" when that name is already used by another slot. */
// eslint-disable-next-line no-unused-vars
export function defaultSlotName(meta, slot, owner = DEFAULT_OWNER) {
  const used = new Set(
    Object.entries(meta?.slots ?? {})
      .filter(([k]) => Number(k) !== slot)
      .map(([, v]) => (v?.name ?? '').toLowerCase()),
  );
  for (let i = 1; ; i += 1) {
    const name = `Shop ${i}`;
    if (!used.has(name.toLowerCase())) return name;
  }
}

/* ---------- meta ---------- */

export function emptyMeta() {
  return { lastSlot: null, slots: {} };
}

export function normalizeMeta(raw) {
  const meta = emptyMeta();
  if (!raw || typeof raw !== 'object') return meta;
  if (isSlot(Number(raw.lastSlot))) meta.lastSlot = Number(raw.lastSlot);
  for (let n = 1; n <= SLOT_COUNT; n += 1) {
    const s = raw.slots?.[n] ?? raw.slots?.[String(n)];
    if (!s || typeof s !== 'object') continue;
    meta.slots[String(n)] = {
      name: cleanSlotName(s.name) || `Slot ${n}`,
      shopLevel: Math.max(1, Math.round(Number(s.shopLevel) || 1)),
      gold: Math.max(0, Math.round(Number(s.gold) || 0)),
      playTime: Math.max(0, Number(s.playTime) || 0),
      savedAt: Number(s.savedAt) || 0,
    };
  }
  return meta;
}

export function metaEntryFor(data, name, savedAt) {
  return {
    name: cleanSlotName(name) || 'Shop',
    shopLevel: Math.max(1, Math.round(Number(data?.shopLevel) || 1)),
    gold: Math.max(0, Math.round(Number(data?.gold) || 0)),
    playTime: Math.max(0, Number(data?.playTime) || 0),
    savedAt,
  };
}

/* ---------- backends ---------- */

/** Async key/value over a Storage-like object (localStorage or a test map). */
export function storageBackend(store) {
  return {
    kind: 'localStorage',
    async get(key) {
      const raw = store.getItem(key);
      return raw == null ? null : raw;
    },
    async set(key, value) {
      store.setItem(key, value);
    },
    async remove(key) {
      store.removeItem(key);
    },
    setSync(key, value) {
      store.setItem(key, value);
      return true;
    },
  };
}

export function memoryStore() {
  const map = new Map();
  return {
    map,
    quota: Infinity,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem(k, v) {
      const s = String(v);
      let used = s.length;
      for (const [key, val] of map) if (key !== k) used += val.length;
      if (used > this.quota) {
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      }
      map.set(k, s);
    },
    removeItem: (k) => map.delete(k),
  };
}

function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** IndexedDB key/value store. Rejects if IndexedDB cannot be opened. */
export async function idbBackend(idb = globalThis.indexedDB, dbName = 'stallhaven-saves') {
  if (!idb) throw new Error('no indexedDB');
  const open = idb.open(dbName, 1);
  open.onupgradeneeded = () => {
    if (!open.result.objectStoreNames.contains('kv')) open.result.createObjectStore('kv');
  };
  const db = await idbRequest(open);
  const tx = (mode, fn) => new Promise((resolve, reject) => {
    const t = db.transaction('kv', mode);
    let out;
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('aborted'));
    const req = fn(t.objectStore('kv'));
    if (req) req.onsuccess = () => { out = req.result; };
  });
  return {
    kind: 'indexedDB',
    get: async (key) => (await tx('readonly', (s) => s.get(key))) ?? null,
    set: (key, value) => tx('readwrite', (s) => s.put(value, key)),
    remove: (key) => tx('readwrite', (s) => s.delete(key)),
    /** Fire-and-forget for pagehide: the transaction is queued before the page unloads. */
    setSync(key, value) {
      try {
        db.transaction('kv', 'readwrite').objectStore('kv').put(value, key);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** IndexedDB if it opens, else localStorage, else memory. */
export async function openBackend({ idb = globalThis.indexedDB, local } = {}) {
  try {
    return await idbBackend(idb);
  } catch {
    let store = local;
    try {
      if (!store && typeof localStorage !== 'undefined') store = localStorage;
    } catch {
      /* private mode */
    }
    return storageBackend(store ?? memoryStore());
  }
}

/* ---------- errors ---------- */

export function errorReason(err) {
  if (!err) return 'unknown';
  if (err.reason) return err.reason;
  const name = err.name ?? '';
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014) {
    return 'quota';
  }
  return 'unknown';
}

/* ---------- slot store ---------- */

/**
 * createSlotStore({ backend, legacy, now })
 *  backend: from openBackend/storageBackend
 *  legacy: Storage-like object holding the old single autosave key (localStorage)
 *  now: () => ms epoch (injectable)
 */
export function createSlotStore({ backend, legacy = null, now = () => Date.now() } = {}) {
  let meta = emptyMeta();

  async function loadMeta() {
    try {
      const raw = await backend.get(META_KEY);
      meta = normalizeMeta(raw ? JSON.parse(raw) : null);
    } catch {
      meta = emptyMeta();
    }
    return meta;
  }

  async function writeMeta() {
    await backend.set(META_KEY, JSON.stringify(meta));
  }

  async function read(slot) {
    if (!isSlot(slot)) return null;
    try {
      const raw = await backend.get(SLOT_KEY(slot));
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : null;
    } catch {
      return null;
    }
  }

  function serialize(data) {
    try {
      const text = JSON.stringify(data);
      if (typeof text !== 'string') throw new Error('serialize');
      return text;
    } catch {
      throw Object.assign(new Error('serialize'), { reason: 'serialize' });
    }
  }

  /** Slot first, then meta (SPEC). Returns { bytes }. */
  async function write(slot, data, name) {
    if (!isSlot(slot)) throw Object.assign(new Error('bad slot'), { reason: 'unknown' });
    const text = serialize(data);
    const savedAt = now();
    const prev = meta.slots[String(slot)];
    await backend.set(SLOT_KEY(slot), text);
    meta.slots[String(slot)] = metaEntryFor(data, name ?? prev?.name ?? defaultSlotName(meta, slot), savedAt);
    meta.lastSlot = slot;
    await writeMeta();
    return { bytes: text.length, savedAt };
  }

  /** Best-effort synchronous-ish write for pagehide/beforeunload. */
  function writeSync(slot, data) {
    if (!isSlot(slot)) return false;
    try {
      const text = JSON.stringify(data);
      const prev = meta.slots[String(slot)];
      if (!backend.setSync(SLOT_KEY(slot), text)) return false;
      meta.slots[String(slot)] = metaEntryFor(data, prev?.name ?? defaultSlotName(meta, slot), now());
      meta.lastSlot = slot;
      return backend.setSync(META_KEY, JSON.stringify(meta));
    } catch {
      return false;
    }
  }

  async function remove(slot) {
    if (!isSlot(slot)) return false;
    await backend.remove(SLOT_KEY(slot));
    delete meta.slots[String(slot)];
    if (meta.lastSlot === slot) meta.lastSlot = null;
    await writeMeta();
    return true;
  }

  async function rename(slot, raw) {
    const name = cleanSlotName(raw);
    const entry = meta.slots[String(slot)];
    if (!name || !entry) return false;
    entry.name = name;
    await writeMeta();
    return true;
  }

  async function setLastSlot(slot) {
    if (!isSlot(slot)) return;
    meta.lastSlot = slot;
    await writeMeta();
  }

  /**
   * One-time migration of the old single autosave key into slot 1 (or the first
   * empty slot if slot 1 is taken). The old key is deleted only after the copy
   * reads back OK. Returns the slot it went into, or null.
   */
  async function migrateLegacy(owner = DEFAULT_OWNER) {
    if (!legacy) return null;
    for (const key of LEGACY_KEYS) {
      let raw = null;
      try {
        raw = legacy.getItem(key);
      } catch {
        raw = null;
      }
      if (!raw) continue;
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
      if (!data || typeof data !== 'object' || !applyState(createState(), data)) {
        // Unreadable: leave it in place rather than lose it.
        continue;
      }
      let target = null;
      for (let n = 1; n <= SLOT_COUNT; n += 1) {
        if (!meta.slots[String(n)] && !(await read(n))) {
          target = n;
          break;
        }
      }
      if (target == null) return null;
      const savedAt = Number(data.savedAt) || now();
      const name = cleanSlotName(data.shopName) || defaultSlotName(meta, target, owner);
      data.shopName = name;
      await backend.set(SLOT_KEY(target), JSON.stringify(data));
      meta.slots[String(target)] = metaEntryFor(data, name, savedAt);
      if (meta.lastSlot == null) meta.lastSlot = target;
      await writeMeta();
      const back = await read(target);
      if (back && back.gold === data.gold && back.version === data.version) {
        try {
          legacy.removeItem(key);
        } catch {
          /* ignore */
        }
      }
      return target;
    }
    return null;
  }

  return {
    backend,
    get meta() {
      return meta;
    },
    loadMeta,
    read,
    write,
    writeSync,
    remove,
    rename,
    setLastSlot,
    migrateLegacy,
  };
}

/* ---------- applying / export ---------- */

/** Load slot data into `state`. Returns true when applied. */
export function applySlotData(state, data, nowSeconds) {
  if (!applyState(state, data)) return false;
  restoreCrafts(state, data.autosaveCrafts, nowSeconds);
  return true;
}

/** Slot payload: the normal save plus crafts as time left and the shop name. */
export function slotData(state, nowSeconds, name) {
  const data = autosaveData(state, nowSeconds);
  if (name) data.shopName = name;
  return data;
}

export function exportFileName(slot, shopLevel) {
  const lv = Math.max(1, Math.round(Number(shopLevel) || 1));
  return `runecraft-slot${slot}-lv${lv}.json`;
}

/**
 * Validate an imported file's text on a scratch state (SPEC: applyState on a
 * scratch state). Returns { ok, data, version, shopLevel } or { ok:false, reason:'invalid' }.
 */
export function validateImport(text, makeState) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'invalid' };
  const scratch = makeState();
  if (!applyState(scratch, data)) return { ok: false, reason: 'invalid' };
  const version = Number(data.version) || 0;
  if (version > SAVE_VERSION) return { ok: false, reason: 'invalid' };
  return { ok: true, data, version, shopLevel: Number(data.shopLevel) || 1 };
}

/** Empty slot preselected, else the current slot (SPEC). */
export function defaultImportSlot(meta, current) {
  for (let n = 1; n <= SLOT_COUNT; n += 1) if (!meta.slots[String(n)]) return n;
  return isSlot(current) ? current : 1;
}

/* ---------- formatting ---------- */

export function formatPlaytime(seconds) {
  const m = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

export function formatAgo(savedAt, nowMs = Date.now()) {
  if (!savedAt) return 'Never saved';
  const s = Math.max(0, Math.round((nowMs - savedAt) / 1000));
  if (s < 45) return 'Last saved just now';
  const m = Math.round(s / 60);
  if (m < 60) return `Last saved ${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Last saved ${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `Last saved ${d} day${d === 1 ? '' : 's'} ago`;
}

export function formatCoins(n) {
  return Math.max(0, Math.round(Number(n) || 0)).toLocaleString('en-US');
}

/* ---------- autosave controller ---------- */

/**
 * Autosave to the active slot. Timer and clock are injectable for tests.
 *
 * opts: {
 *   store, getState, nowSeconds(), getName(),
 *   timers: { setInterval, clearInterval, setTimeout, clearTimeout },
 *   intervalMs, emit(event, detail), onStatus(state)  // 'saving'|'ok'|'error'|'idle'
 * }
 * Returns { slot, setSlot, save(trigger), saveSync(trigger), saveNow, pause, resume, paused,
 *           start, stop, guest, setGuest, restore(state, nowSeconds) }.
 * saveNow/pause/resume/paused keep the co-op autosave contract.
 */
export function createAutosave(opts) {
  const {
    store,
    getState,
    nowSeconds = () => 0,
    getName = () => null,
    timers = globalThis,
    intervalMs = AUTOSAVE_EVERY_MS,
    emit = () => {},
    onStatus = () => {},
    clockMs = () => Date.now(),
  } = opts;
  let slot = null;
  let paused = false;
  let guest = false;
  let timer = null;
  let pillTimer = null;
  let fadeTimer = null;
  let lastData = null;
  let inFlight = null;
  let erroring = false;

  const blocked = () => paused || guest || !isSlot(slot);

  function status(s) {
    if (s === 'saving') {
      if (pillTimer != null) timers.clearTimeout(pillTimer);
      pillTimer = timers.setTimeout(() => {
        pillTimer = null;
        if (!erroring) onStatus('saving');
      }, SAVING_PILL_DELAY_MS);
      return;
    }
    if (pillTimer != null) timers.clearTimeout(pillTimer);
    pillTimer = null;
    if (fadeTimer != null) timers.clearTimeout(fadeTimer);
    fadeTimer = null;
    onStatus(s);
    if (s === 'ok') {
      fadeTimer = timers.setTimeout(() => {
        fadeTimer = null;
        onStatus('idle');
      }, OK_FADE_MS);
    }
  }

  async function save(trigger = 'manual') {
    if (blocked()) return false;
    const target = slot;
    const started = clockMs();
    emit('save_started', { slot: target, trigger });
    status('saving');
    let data;
    try {
      data = slotData(getState(), nowSeconds(), getName());
    } catch {
      erroring = true;
      status('error');
      emit('save_error', { slot: target, reason: 'serialize' });
      return false;
    }
    const run = (async () => {
      try {
        const { bytes } = await store.write(target, data, getName());
        lastData = data;
        erroring = false;
        status('ok');
        emit('save_ok', { slot: target, bytes, ms: Math.max(0, clockMs() - started) });
        return true;
      } catch (err) {
        erroring = true;
        status('error');
        emit('save_error', { slot: target, reason: errorReason(err) });
        return false;
      }
    })();
    inFlight = run;
    const ok = await run;
    if (inFlight === run) inFlight = null;
    return ok;
  }

  function saveSync(trigger = 'close') {
    if (blocked()) return false;
    emit('save_started', { slot, trigger });
    try {
      const data = slotData(getState(), nowSeconds(), getName());
      const ok = store.writeSync(slot, data);
      if (ok) {
        lastData = data;
        emit('save_ok', { slot, bytes: JSON.stringify(data).length, ms: 0 });
      } else emit('save_error', { slot, reason: 'unknown' });
      return ok;
    } catch {
      emit('save_error', { slot, reason: 'serialize' });
      return false;
    }
  }

  function start() {
    stop();
    timer = timers.setInterval(() => {
      save('interval');
    }, intervalMs);
  }

  function stop() {
    if (timer != null) timers.clearInterval(timer);
    timer = null;
  }

  return {
    get slot() {
      return slot;
    },
    setSlot(n, data = null) {
      slot = isSlot(n) ? n : null;
      lastData = data;
    },
    save,
    saveSync,
    /** Co-op contract: fire an immediate save of the active slot. */
    saveNow() {
      if (blocked()) return false;
      save('manual');
      return true;
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    get paused() {
      return paused;
    },
    get guest() {
      return guest;
    },
    setGuest(on) {
      guest = Boolean(on);
    },
    get erroring() {
      return erroring;
    },
    get lastData() {
      return lastData;
    },
    /** Put the active slot's last written save back into `state` (guest leaving a party). */
    restore(state, now) {
      if (!lastData) return false;
      return applySlotData(state, lastData, now);
    },
    whenIdle: () => inFlight ?? Promise.resolve(true),
    start,
    stop,
  };
}
