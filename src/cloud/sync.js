/**
 * Cloud sync engine for the 3 save slots. DOM-free; the backend is pluggable
 * (supabaseClient.js for real/mock Supabase, memoryBackend.js for unit tests).
 *
 * Rules (Luke + Youi SPEC §4):
 * - Upload on every autosave while signed in; pull on sign-in and on startup.
 * - Last write wins by revision: the server only accepts a write whose base
 *   revision matches the stored one (compare-and-swap in save_slot()).
 * - Conflict = both sides changed since the last sync: local savedAt > syncedAt
 *   and the cloud revision moved past the one we last saw.
 * - First sign-in: cloud only → download, local only → upload, both and
 *   different → conflict. Equal data → synced.
 * - Offline: uploads and deletes wait in a queue kept in localStorage.
 * - A slot in conflict never syncs until the player chooses.
 */
export const SYNC_KEY = 'rc-cloud-sync';
export const QUEUE_KEY = 'rc-cloud-queue';
export const SLOTS = [1, 2, 3];

function readJson(kv, key, fallback) {
  try {
    const raw = kv?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(kv, key, value) {
  try {
    kv?.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Compare two saves, ignoring when they were written. */
export function sameSave(a, b) {
  if (!a || !b) return false;
  const strip = (d) => {
    const { savedAt: _s, ...rest } = d;
    return JSON.stringify(rest);
  };
  return strip(a) === strip(b);
}

/**
 * local: meta entry ({ savedAt, … }) or null; cloud: row or null;
 * sync: { revision, syncedAt } or null. Returns one of
 * 'none' | 'synced' | 'upload' | 'download' | 'conflict'.
 */
export function decideSlot({ local, cloud, sync, same = false }) {
  if (!local && !cloud) return 'none';
  if (!local) return 'download';
  if (!cloud) return 'upload';
  const localChanged = !sync || (Number(local.savedAt) || 0) > (Number(sync.syncedAt) || 0);
  const cloudChanged = !sync || Number(cloud.revision) !== Number(sync.revision);
  if (!localChanged && !cloudChanged) return 'synced';
  if (localChanged && !cloudChanged) return 'upload';
  if (!localChanged && cloudChanged) return 'download';
  return same ? 'synced' : 'conflict';
}

export function createCloudSync({
  client,
  store,
  kv = null,
  deviceId = '',
  deviceLabel = '',
  isLive = () => false,
  emit = () => {},
  now = () => Date.now(),
  saveVersion = Infinity,
}) {
  let sync = readJson(kv, SYNC_KEY, { userId: null, slots: {}, lastSyncAt: 0 });
  let queue = readJson(kv, QUEUE_KEY, { up: [], del: [] });
  const status = {}; // slot -> synced|syncing|local|conflict
  const conflicts = new Map(); // slot -> { cloud: row|null }
  let offline = false;
  let paused = false; // co-op guest
  let running = null;

  const userId = () => client.session?.user?.id ?? null;
  const signedIn = () => Boolean(client.session);

  function saveSync() {
    writeJson(kv, SYNC_KEY, sync);
  }
  function saveQueue() {
    writeJson(kv, QUEUE_KEY, queue);
  }
  function ensureUser() {
    const id = userId();
    if (id && sync.userId !== id) {
      sync = { userId: id, slots: {}, lastSyncAt: 0 };
      saveSync();
    }
  }
  function setStatus(slot, s) {
    status[slot] = s;
    emit('cloud_status', { slot, status: s });
  }
  function markSynced(slot, row, savedAt) {
    sync.slots[slot] = { revision: row.revision, syncedAt: savedAt, updatedAt: row.updated_at, deviceLabel: row.device_label ?? '' };
    sync.lastSyncAt = now();
    saveSync();
    conflicts.delete(slot);
    setStatus(slot, 'synced');
  }
  function markConflict(slot, cloud) {
    conflicts.set(slot, { cloud });
    setStatus(slot, 'conflict');
    emit('cloud_conflict', { slot });
  }
  function handleError(err, slot) {
    if (err?.offline) {
      offline = true;
      emit('cloud_offline', { offline: true });
      if (slot) setStatus(slot, status[slot] === 'syncing' ? 'local' : status[slot] ?? 'local');
      return 'offline';
    }
    if (err?.signedOut) {
      emit('cloud_signed_out', { reason: 'expired' });
      return 'signed_out';
    }
    if (slot) emit('cloud_sync_error', { slot, reason: 'unknown' });
    return 'unknown';
  }
  function backOnline() {
    if (offline) {
      offline = false;
      emit('cloud_offline', { offline: false });
    }
  }

  async function upload(slot, { force = false } = {}) {
    const data = await store.read(slot);
    const entry = store.meta.slots[String(slot)];
    if (!data || !entry) return 'none';
    const base = force ? (conflicts.get(slot)?.cloud?.revision ?? 0) : (sync.slots[slot]?.revision ?? 0);
    emit('cloud_sync_started', { slot });
    setStatus(slot, 'syncing');
    const res = await client.saveSlot({
      slot,
      data,
      name: entry.name,
      level: entry.shopLevel,
      playtime: entry.playTime,
      deviceId,
      deviceLabel,
      baseRevision: base,
    });
    backOnline();
    if (res.ok) {
      markSynced(slot, res.row, entry.savedAt);
      emit('cloud_sync_ok', { slot, revision: res.row.revision });
      return 'uploaded';
    }
    markConflict(slot, res.row ?? null);
    return 'conflict';
  }

  async function download(slot, row) {
    emit('cloud_sync_started', { slot });
    setStatus(slot, 'syncing');
    const data = { ...row.data, shopName: row.name || row.data?.shopName };
    const last = store.meta.lastSlot;
    const { savedAt } = await store.write(slot, data, row.name || undefined);
    // A background download is not "playing" that slot.
    if (last && last !== slot) await store.setLastSlot(last);
    markSynced(slot, row, savedAt);
    emit('cloud_sync_ok', { slot, revision: row.revision, downloaded: true });
    return 'downloaded';
  }

  async function flushQueue() {
    for (const slot of [...queue.del]) {
      await client.deleteSlot(slot);
      queue.del = queue.del.filter((s) => s !== slot);
      delete sync.slots[slot];
      saveQueue();
      saveSync();
    }
    for (const slot of [...queue.up]) {
      queue.up = queue.up.filter((s) => s !== slot);
      saveQueue();
      if (conflicts.has(slot)) continue;
      try {
        await upload(slot);
      } catch (err) {
        if (!queue.up.includes(slot)) queue.up.push(slot);
        saveQueue();
        throw err;
      }
    }
  }

  /** Pull every slot from the cloud and reconcile. Returns { slot: action }. */
  async function pullNow() {
    ensureUser();
    const rows = await client.listSaves();
    backOnline();
    const bySlot = Object.fromEntries(rows.map((r) => [r.slot, r]));
    const result = {};
    for (const slot of SLOTS) {
      if (queue.del.includes(slot)) continue;
      const local = store.meta.slots[String(slot)] ?? null;
      const cloud = bySlot[slot] ?? null;
      const s = sync.slots[slot] ?? null;
      let same = false;
      if (local && cloud && (!s || (local.savedAt > (s?.syncedAt ?? 0)))) {
        same = sameSave(await store.read(slot), cloud.data);
      }
      // A save written by a newer game version: never load or overwrite it here
      // (an old cached copy of the game would drop the fields it doesn't know).
      if (cloud && Number(cloud.data?.version) > saveVersion) {
        result[slot] = 'newer-version';
        setStatus(slot, 'local');
        emit('cloud_sync_error', { slot, reason: 'newer_version' });
        continue;
      }
      let action = decideSlot({ local, cloud, sync: s, same });
      // Never swap the shop out from under a running game: ask instead.
      if (action === 'download' && local && isLive(slot)) action = 'conflict';
      result[slot] = action;
      if (action === 'download') await download(slot, cloud);
      else if (action === 'upload') {
        if (!queue.up.includes(slot)) queue.up.push(slot);
      } else if (action === 'synced') markSynced(slot, cloud, local.savedAt);
      else if (action === 'conflict') markConflict(slot, cloud);
      else setStatus(slot, 'local');
    }
    saveQueue();
    await flushQueue();
    return result;
  }

  function serial(fn) {
    const run = (running ?? Promise.resolve()).catch(() => {}).then(fn);
    running = run;
    return run;
  }

  return {
    get signedIn() {
      return signedIn();
    },
    get email() {
      return client.session?.user?.email ?? null;
    },
    get offline() {
      return offline;
    },
    get lastSyncAt() {
      return sync.lastSyncAt || 0;
    },
    get paused() {
      return paused;
    },
    setPaused(on) {
      paused = Boolean(on);
    },
    status: (slot) => (signedIn() ? status[slot] ?? 'local' : 'local'),
    conflict: (slot) => conflicts.get(slot) ?? null,
    conflictSlots: () => [...conflicts.keys()],
    syncInfo: (slot) => sync.slots[slot] ?? null,
    get queue() {
      return { up: [...queue.up], del: [...queue.del] };
    },

    pull() {
      if (!signedIn() || paused) return Promise.resolve(null);
      return serial(async () => {
        try {
          return await pullNow();
        } catch (err) {
          handleError(err);
          return null;
        }
      });
    },

    /** Called after every local save_ok. */
    markDirty(slot) {
      if (!signedIn() || paused) return Promise.resolve(null);
      if (!queue.up.includes(slot)) queue.up.push(slot);
      saveQueue();
      if (conflicts.has(slot)) return Promise.resolve('conflict');
      return serial(async () => {
        try {
          ensureUser();
          await flushQueue();
          return 'ok';
        } catch (err) {
          return handleError(err, slot);
        }
      });
    },

    /** Called when a slot is deleted on this device. */
    markDeleted(slot) {
      conflicts.delete(slot);
      queue.up = queue.up.filter((s) => s !== slot);
      if (!signedIn() || paused) {
        saveQueue();
        return Promise.resolve(null);
      }
      if (!queue.del.includes(slot)) queue.del.push(slot);
      saveQueue();
      return serial(async () => {
        try {
          await flushQueue();
          return 'ok';
        } catch (err) {
          return handleError(err);
        }
      });
    },

    flush() {
      if (!signedIn() || paused) return Promise.resolve(null);
      return serial(async () => {
        try {
          await flushQueue();
          return 'ok';
        } catch (err) {
          return handleError(err);
        }
      });
    },

    /** choice: 'local' | 'cloud' | 'both'. Returns { ok, copySlot? }. */
    resolve(slot, choice) {
      return serial(async () => {
        const c = conflicts.get(slot);
        if (!c) return { ok: false };
        try {
          if (choice === 'cloud') {
            if (c.cloud) await download(slot, c.cloud);
            else {
              // Cloud copy was deleted elsewhere: keeping "cloud" means removing it here.
              await store.remove(slot);
              conflicts.delete(slot);
              setStatus(slot, 'local');
            }
            emit('cloud_conflict_resolved', { slot, choice });
            return { ok: true };
          }
          let copySlot = null;
          if (choice === 'both') {
            copySlot = SLOTS.find((n) => !store.meta.slots[String(n)]) ?? null;
            if (!copySlot || !c.cloud) return { ok: false };
            const copyName = `${(c.cloud.name || c.cloud.data?.shopName || `Slot ${slot}`).slice(0, 19)} (cloud copy)`;
            const data = { ...c.cloud.data, shopName: copyName };
            const last = store.meta.lastSlot;
            await store.write(copySlot, data, copyName);
            if (last) await store.setLastSlot(last);
          }
          await upload(slot, { force: true });
          if (copySlot) {
            if (!queue.up.includes(copySlot)) queue.up.push(copySlot);
            saveQueue();
            await flushQueue();
          }
          emit('cloud_conflict_resolved', { slot, choice });
          return { ok: true, copySlot };
        } catch (err) {
          handleError(err, slot);
          return { ok: false };
        }
      });
    },

    async signOut({ removeLocal = false } = {}) {
      await client.signOut();
      sync = { userId: null, slots: {}, lastSyncAt: 0 };
      queue = { up: [], del: [] };
      saveSync();
      saveQueue();
      conflicts.clear();
      for (const k of Object.keys(status)) delete status[k];
      if (removeLocal) for (const n of SLOTS) await store.remove(n);
      emit('cloud_signed_out', { reason: 'user', removedLocal: removeLocal });
    },

    /** Wait for queued work (tests). */
    idle: () => (running ?? Promise.resolve()).catch(() => {}),
  };
}
