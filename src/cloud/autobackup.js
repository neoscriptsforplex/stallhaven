/**
 * Automatic local backup file (Luke's decision 2).
 * - Chrome/Edge (File System Access API): the player picks stallhaven-backup.json
 *   once; it is rewritten after every autosave and on Save now.
 * - Elsewhere (Safari, Firefox, phones): no toggle. A "Download a backup" button
 *   plus a reminder once a week.
 * Per-device settings in localStorage; works without signing in.
 */
export const BACKUP_FILE = 'stallhaven-backup.json';
export const PREF_KEY = 'rc-autobackup';
export const LAST_DOWNLOAD_KEY = 'rc-backup-downloaded-at';
export const REMIND_EVERY_MS = 7 * 24 * 3600 * 1000;

export function supportsFilePicker(win = globalThis) {
  return typeof win?.showSaveFilePicker === 'function';
}

/** One file holding all 3 slots. */
export async function buildBackup(store, now = Date.now()) {
  const slots = {};
  for (const n of [1, 2, 3]) {
    const data = await store.read(n);
    if (data) slots[n] = { name: store.meta.slots[String(n)]?.name ?? `Slot ${n}`, data };
  }
  return { kind: 'stallhaven-backup', version: 1, writtenAt: new Date(now).toISOString(), slots };
}

/** Weekly reminder: only when there is something to back up. */
export function needsReminder({ lastDownloadAt, now = Date.now(), hasSaves }) {
  if (!hasSaves) return false;
  return !lastDownloadAt || now - lastDownloadAt >= REMIND_EVERY_MS;
}

/** Pull a single slot back out of a backup file (for Import). */
export function slotFromBackup(json, slot) {
  if (json?.kind !== 'stallhaven-backup') return null;
  return json.slots?.[slot]?.data ?? null;
}

function openDb(idb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    const req = idb.open('stallhaven-backup', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbDo(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', mode);
    const req = fn(tx.objectStore('kv'));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export function createAutoBackup({ store, kv, emit = () => {}, win = globalThis, now = () => Date.now() }) {
  const supported = supportsFilePicker(win);
  let handle = null;
  let pref = (() => {
    try {
      return JSON.parse(kv?.getItem(PREF_KEY) ?? 'null') ?? { on: false };
    } catch {
      return { on: false };
    }
  })();
  let needsPermission = false;
  const savePref = () => {
    try {
      kv?.setItem(PREF_KEY, JSON.stringify(pref));
    } catch {
      /* ignore */
    }
  };

  async function loadHandle() {
    if (!supported || !pref.on) return;
    try {
      handle = (await idbDo('readonly', (s) => s.get('handle'))) ?? null;
      if (handle?.queryPermission) needsPermission = (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted';
    } catch {
      handle = null;
    }
  }

  async function pickFile() {
    handle = await win.showSaveFilePicker({
      suggestedName: BACKUP_FILE,
      types: [{ description: 'Store of Geilenor backup', accept: { 'application/json': ['.json'] } }],
    });
    needsPermission = false;
    try {
      await idbDo('readwrite', (s) => s.put(handle, 'handle'));
    } catch {
      /* the handle just won't survive a reload */
    }
    pref = { ...pref, on: true, fileName: handle.name ?? BACKUP_FILE };
    savePref();
  }

  async function write() {
    if (!supported || !pref.on || !handle) return false;
    try {
      if (needsPermission) {
        if (!handle.requestPermission) return false;
        // Needs a user gesture; the UI calls write() from a click when this is set.
        if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return false;
        needsPermission = false;
      }
      const text = `${JSON.stringify(await buildBackup(store, now()), null, 1)}\n`;
      const w = await handle.createWritable();
      await w.write(text);
      await w.close();
      pref = { ...pref, lastWriteAt: now() };
      savePref();
      emit('autobackup_written', { bytes: text.length });
      return true;
    } catch (err) {
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') needsPermission = true;
      return false;
    }
  }

  async function download() {
    const text = `${JSON.stringify(await buildBackup(store, now()), null, 1)}\n`;
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = BACKUP_FILE;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    try {
      kv?.setItem(LAST_DOWNLOAD_KEY, String(now()));
    } catch {
      /* ignore */
    }
    emit('autobackup_written', { bytes: text.length, download: true });
    return true;
  }

  return {
    supported,
    get on() {
      return Boolean(pref.on);
    },
    get fileName() {
      return pref.fileName ?? BACKUP_FILE;
    },
    get lastWriteAt() {
      return pref.lastWriteAt ?? 0;
    },
    get needsPermission() {
      return needsPermission;
    },
    lastDownloadAt() {
      return Number(kv?.getItem(LAST_DOWNLOAD_KEY)) || 0;
    },
    loadHandle,
    async enable() {
      await pickFile();
      emit('autobackup_toggled', { on: true });
      await write();
    },
    async changeFile() {
      await pickFile();
      await write();
    },
    disable() {
      pref = { ...pref, on: false };
      savePref();
      handle = null;
      idbDo('readwrite', (s) => s.delete('handle')).catch(() => {});
      emit('autobackup_toggled', { on: false });
    },
    write,
    download,
  };
}
