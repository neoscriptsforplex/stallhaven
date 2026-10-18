/**
 * Browser autosave. The shop is written to localStorage every few seconds and
 * when the tab is hidden or closed, and read back on start. Crafts in progress
 * are kept too (as time left), because their cost is paid up front.
 *
 * Co-op guests pause autosave so the room's shop never overwrites their own.
 */
import { applyState, serializeState } from './economy.js';

export const AUTOSAVE_KEY = 'stallhaven-autosave-v1';
export const AUTOSAVE_INTERVAL_MS = 10000;

function storage(store) {
  if (store) return store;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* Private mode can throw on access. */
  }
  return null;
}

/** Plain object for the autosave: the normal save plus crafts as time left. */
export function autosaveData(state, nowSeconds) {
  const data = serializeState(state);
  const crafts = {};
  for (const [id, craft] of Object.entries(state.crafts ?? {})) {
    if (!craft) continue;
    const elapsed = Math.max(0, (nowSeconds ?? 0) - (craft.startedAt ?? 0));
    crafts[id] = {
      elapsed: Math.min(elapsed, craft.duration ?? 0),
      duration: craft.duration,
      left: craft.left ?? 1,
      total: craft.total ?? craft.left ?? 1,
    };
  }
  data.autosaveCrafts = crafts;
  data.savedAt = Date.now();
  return data;
}

export function writeAutosave(state, nowSeconds, store) {
  const s = storage(store);
  if (!s) return false;
  try {
    s.setItem(AUTOSAVE_KEY, JSON.stringify(autosaveData(state, nowSeconds)));
    return true;
  } catch {
    return false;
  }
}

export function readAutosave(store) {
  const s = storage(store);
  if (!s) return null;
  try {
    const raw = s.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/** Load the autosave into `state`. Returns true when a save was applied. */
export function loadAutosave(state, nowSeconds, store) {
  const data = readAutosave(store);
  if (!data) return false;
  if (!applyState(state, data)) return false;
  restoreCrafts(state, data.autosaveCrafts, nowSeconds);
  return true;
}

export function restoreCrafts(state, crafts, nowSeconds) {
  if (!crafts || typeof crafts !== 'object') return;
  for (const [id, c] of Object.entries(crafts)) {
    if (!c || typeof c !== 'object') continue;
    const duration = Number(c.duration);
    const left = Math.round(Number(c.left));
    if (!Number.isFinite(duration) || duration < 0 || !Number.isFinite(left) || left < 1) continue;
    const elapsed = Math.max(0, Math.min(duration, Number(c.elapsed) || 0));
    state.crafts[id] = {
      startedAt: (nowSeconds ?? 0) - elapsed,
      duration,
      left,
      total: Math.max(left, Math.round(Number(c.total)) || left),
    };
  }
}

export function clearAutosave(store) {
  const s = storage(store);
  try {
    s?.removeItem(AUTOSAVE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Start saving on a timer and on tab hide/close.
 * Returns { saveNow, pause, resume, paused, stop }.
 */
export function startAutosave(state, { clock, store, intervalMs = AUTOSAVE_INTERVAL_MS, target } = {}) {
  const now = () => (clock ? clock.now() : performance.now() / 1000);
  let paused = false;
  const saveNow = () => (paused ? false : writeAutosave(state, now(), store));
  const timer = setInterval(saveNow, intervalMs);
  const win = target ?? (typeof window !== 'undefined' ? window : null);
  const onHide = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'hidden') saveNow();
  };
  win?.addEventListener?.('pagehide', saveNow);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHide);
  return {
    saveNow,
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    get paused() {
      return paused;
    },
    stop() {
      clearInterval(timer);
      win?.removeEventListener?.('pagehide', saveNow);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHide);
    },
  };
}
