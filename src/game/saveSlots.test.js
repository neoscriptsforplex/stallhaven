import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, serializeState, SAVE_VERSION } from './economy.js';
import { AUTOSAVE_KEY, autosaveData } from './autosave.js';
import {
  AUTOSAVE_EVERY_MS,
  META_KEY,
  SLOT_KEY,
  applySlotData,
  cleanSlotName,
  createAutosave,
  createSlotStore,
  defaultImportSlot,
  defaultSlotName,
  errorReason,
  exportFileName,
  formatAgo,
  formatPlaytime,
  memoryStore,
  normalizeMeta,
  openBackend,
  storageBackend,
  validateImport,
} from './saveSlots.js';

function setup(nowMs = 1_000_000) {
  const local = memoryStore();
  const backend = storageBackend(local);
  let t = nowMs;
  const store = createSlotStore({ backend, legacy: local, now: () => t });
  return { local, backend, store, tick: (ms) => { t += ms; }, now: () => t };
}

/** Manual timers so the 3-minute autosave can be stepped without waiting. */
function fakeTimers() {
  let id = 0;
  let now = 0;
  const jobs = new Map();
  return {
    setInterval(fn, ms) { id += 1; jobs.set(id, { fn, at: now + ms, every: ms }); return id; },
    clearInterval(i) { jobs.delete(i); },
    setTimeout(fn, ms) { id += 1; jobs.set(id, { fn, at: now + ms, every: 0 }); return id; },
    clearTimeout(i) { jobs.delete(i); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let next = null;
        for (const [k, j] of jobs) if (j.at <= end && (!next || j.at < next[1].at)) next = [k, j];
        if (!next) break;
        const [k, j] = next;
        now = j.at;
        if (j.every) j.at += j.every; else jobs.delete(k);
        j.fn();
      }
      now = end;
    },
    get pending() { return jobs.size; },
  };
}
const flush = () => new Promise((r) => setImmediate(r));

/* ---------- storage ---------- */

test('writes slot then meta under rc-save-slot-N and rc-save-meta', async () => {
  const { local, store } = setup();
  await store.loadMeta();
  const s = createState();
  s.gold = 999;
  const order = [];
  const orig = local.setItem.bind(local);
  local.setItem = (k, v) => { order.push(k); orig(k, v); };
  const { bytes } = await store.write(2, autosaveData(s, 0), 'Rune Corner');
  assert.deepEqual(order, [SLOT_KEY(2), META_KEY]);
  assert.ok(bytes > 100);
  const meta = JSON.parse(local.getItem(META_KEY));
  assert.equal(meta.lastSlot, 2);
  assert.equal(meta.slots['2'].name, 'Rune Corner');
  assert.equal(meta.slots['2'].gold, 999);
  assert.equal(meta.slots['2'].savedAt, 1_000_000);
  assert.equal(JSON.parse(local.getItem(SLOT_KEY(2))).version, SAVE_VERSION);
});

test('slots are independent and survive a reload of meta', async () => {
  const { backend, store, local } = setup();
  await store.loadMeta();
  const a = createState(); a.gold = 10;
  const b = createState(); b.gold = 20;
  await store.write(1, autosaveData(a, 0), 'A');
  await store.write(3, autosaveData(b, 0), 'B');
  const again = createSlotStore({ backend, legacy: local });
  await again.loadMeta();
  assert.deepEqual(Object.keys(again.meta.slots).sort(), ['1', '3']);
  assert.equal((await again.read(1)).gold, 10);
  assert.equal((await again.read(3)).gold, 20);
  assert.equal(await again.read(2), null);
  await again.remove(3);
  assert.equal(await again.read(3), null);
  assert.equal(again.meta.lastSlot, null);
  assert.equal(again.meta.slots['3'], undefined);
});

test('a full browser storage surfaces as reason quota', async () => {
  const { local, store } = setup();
  await store.loadMeta();
  local.quota = 50;
  await assert.rejects(store.write(1, autosaveData(createState(), 0), 'X'), (err) => errorReason(err) === 'quota');
});

test('corrupt meta or slot data reads as empty', async () => {
  const { local, store } = setup();
  local.setItem(META_KEY, '{nope');
  local.setItem(SLOT_KEY(1), '{nope');
  await store.loadMeta();
  assert.deepEqual(store.meta.slots, {});
  assert.equal(await store.read(1), null);
  assert.equal(await store.read(9), null);
  assert.deepEqual(normalizeMeta({ lastSlot: 7, slots: { 4: { name: 'x' } } }), { lastSlot: null, slots: {} });
});

test('openBackend falls back to localStorage when IndexedDB is missing', async () => {
  const local = memoryStore();
  const b = await openBackend({ idb: null, local });
  assert.equal(b.kind, 'localStorage');
  await b.set('k', 'v');
  assert.equal(local.getItem('k'), 'v');
});

test('openBackend falls back when IndexedDB fails to open', async () => {
  const local = memoryStore();
  const idb = { open() { const req = {}; setTimeout(() => { req.error = new Error('blocked'); req.onerror?.(); }); return req; } };
  const b = await openBackend({ idb, local });
  assert.equal(b.kind, 'localStorage');
});

/* ---------- migration ---------- */

test('the old single autosave key moves into slot 1 once and is deleted', async () => {
  const { local, store } = setup();
  const s = createState();
  s.gold = 4321;
  local.setItem(AUTOSAVE_KEY, JSON.stringify(autosaveData(s, 0)));
  await store.loadMeta();
  assert.equal(await store.migrateLegacy(), 1);
  assert.equal(local.getItem(AUTOSAVE_KEY), null);
  assert.equal((await store.read(1)).gold, 4321);
  assert.equal(store.meta.slots['1'].name, "Luke's Shop");
  assert.equal(store.meta.lastSlot, 1);
  assert.equal(await store.migrateLegacy(), null);
});

test('migration picks the first empty slot when slot 1 is taken', async () => {
  const { local, store } = setup();
  await store.loadMeta();
  await store.write(1, autosaveData(createState(), 0), "Luke's Shop");
  local.setItem(AUTOSAVE_KEY, JSON.stringify(autosaveData(createState(), 0)));
  assert.equal(await store.migrateLegacy(), 2);
  assert.equal(store.meta.slots['2'].name, "Luke's Shop 2");
  assert.equal(store.meta.lastSlot, 1);
});

test('an unreadable old autosave is left alone rather than lost', async () => {
  const { local, store } = setup();
  local.setItem(AUTOSAVE_KEY, '{broken');
  await store.loadMeta();
  assert.equal(await store.migrateLegacy(), null);
  assert.equal(local.getItem(AUTOSAVE_KEY), '{broken');
});

test('slot data round-trips crafts as time left and the shop name', async () => {
  const { store } = setup();
  await store.loadMeta();
  const s = createState();
  s.shopName = 'Rune Corner';
  s.chest.air_rune = 2;
  await store.write(1, autosaveData(s, 5), 'Rune Corner');
  const back = createState();
  assert.ok(applySlotData(back, await store.read(1), 100));
  assert.equal(back.chest.air_rune, 2);
  assert.equal(back.shopName, 'Rune Corner');
  assert.equal(serializeState(back).shopName, 'Rune Corner');
});

/* ---------- naming ---------- */

test('names are cleaned, capped and default to a unique Luke\'s Shop', () => {
  assert.equal(cleanSlotName('  Rune   <b>Corner</b>  '), 'Rune bCorner/b');
  assert.equal(cleanSlotName('x'.repeat(50)).length, 32);
  assert.equal(cleanSlotName('   '), '');
  const meta = { slots: { 1: { name: "Luke's Shop" }, 2: { name: "Luke's Shop 2" } } };
  assert.equal(defaultSlotName({ slots: {} }, 1), "Luke's Shop");
  assert.equal(defaultSlotName(meta, 3), "Luke's Shop 3");
  assert.equal(defaultSlotName(meta, 1), "Luke's Shop", 'a slot does not clash with its own name');
});

test('rename edits the slot card name only for filled slots', async () => {
  const { store } = setup();
  await store.loadMeta();
  await store.write(1, autosaveData(createState(), 0), 'Old');
  assert.equal(await store.rename(1, '  New Name '), true);
  assert.equal(store.meta.slots['1'].name, 'New Name');
  assert.equal(await store.rename(1, '   '), false);
  assert.equal(await store.rename(2, 'Nope'), false);
  await store.write(1, autosaveData(createState(), 0));
  assert.equal(store.meta.slots['1'].name, 'New Name', 'a later save keeps the name');
});

/* ---------- autosave timer ---------- */

function autosaveRig(extra = {}) {
  const rig = setup();
  const timers = fakeTimers();
  const events = [];
  const statuses = [];
  const state = createState();
  const auto = createAutosave({
    store: rig.store,
    getState: () => state,
    nowSeconds: () => 0,
    getName: () => 'Shop',
    timers,
    emit: (type, d) => events.push({ type, ...d }),
    onStatus: (s) => statuses.push(s),
    ...extra,
  });
  return { ...rig, timers, events, statuses, state, auto };
}

test('autosave writes the active slot every 3 minutes', async () => {
  const r = autosaveRig();
  await r.store.loadMeta();
  r.auto.setSlot(2);
  r.auto.start();
  assert.equal(AUTOSAVE_EVERY_MS, 180000);
  r.timers.advance(179_999);
  await flush();
  assert.equal(r.events.length, 0);
  r.state.gold = 77;
  r.timers.advance(1);
  await flush();
  assert.deepEqual(r.events.map((e) => e.type), ['save_started', 'save_ok']);
  assert.deepEqual(r.events[0], { type: 'save_started', slot: 2, trigger: 'interval' });
  assert.equal((await r.store.read(2)).gold, 77);
  r.timers.advance(180_000 * 2);
  await flush();
  assert.equal(r.events.filter((e) => e.type === 'save_ok').length, 3);
  r.auto.stop();
  r.timers.advance(180_000);
  await flush();
  assert.equal(r.events.filter((e) => e.type === 'save_ok').length, 3);
});

test('the Saving pill waits 300 ms and Saved fades after 1.5 s', async () => {
  const r = autosaveRig();
  await r.store.loadMeta();
  r.auto.setSlot(1);
  await r.auto.save('manual');
  assert.deepEqual(r.statuses, ['ok'], 'a fast save never flashes Saving');
  r.timers.advance(1499);
  assert.deepEqual(r.statuses, ['ok']);
  r.timers.advance(1);
  assert.deepEqual(r.statuses, ['ok', 'idle']);
});

test('save errors report quota and keep the error bar until a save succeeds', async () => {
  const r = autosaveRig();
  await r.store.loadMeta();
  r.auto.setSlot(1);
  r.local.quota = 10;
  assert.equal(await r.auto.save('interval'), false);
  assert.deepEqual(r.events.at(-1), { type: 'save_error', slot: 1, reason: 'quota' });
  assert.equal(r.statuses.at(-1), 'error');
  r.timers.advance(5000);
  assert.equal(r.statuses.at(-1), 'error');
  r.local.quota = Infinity;
  assert.equal(await r.auto.save('manual'), true);
  assert.equal(r.statuses.at(-1), 'ok');
});

test('a state that cannot serialize reports reason serialize', async () => {
  const r = autosaveRig({ getState: () => { throw new Error('boom'); } });
  await r.store.loadMeta();
  r.auto.setSlot(1);
  assert.equal(await r.auto.save('manual'), false);
  assert.equal(r.events.at(-1).reason, 'serialize');
});

test('no slot, paused or co-op guest means nothing is written', async () => {
  const r = autosaveRig();
  await r.store.loadMeta();
  assert.equal(await r.auto.save('manual'), false);
  r.auto.setSlot(1);
  r.auto.setGuest(true);
  assert.equal(await r.auto.save('interval'), false);
  assert.equal(r.auto.saveSync('close'), false);
  assert.equal(r.auto.saveNow(), false);
  r.auto.setGuest(false);
  r.auto.pause();
  assert.equal(await r.auto.save('hidden'), false);
  assert.equal(r.local.getItem(SLOT_KEY(1)), null);
  r.auto.resume();
  assert.equal(await r.auto.save('hidden'), true);
});

test('pagehide write is synchronous and the guest can restore their own save', async () => {
  const r = autosaveRig();
  await r.store.loadMeta();
  r.auto.setSlot(3);
  r.state.gold = 55;
  assert.equal(r.auto.saveSync('close'), true);
  assert.equal(JSON.parse(r.local.getItem(SLOT_KEY(3))).gold, 55);
  assert.equal(JSON.parse(r.local.getItem(META_KEY)).slots['3'].gold, 55);
  // Join as guest: the room overwrites the in-memory shop, then restore puts it back.
  r.auto.setGuest(true);
  r.state.gold = 9_999_999;
  assert.equal(r.auto.restore(r.state, 0), true);
  assert.equal(r.state.gold, 55);
});

/* ---------- import / export ---------- */

test('import validates on a scratch state and accepts old versions', () => {
  const s = createState();
  s.gold = 321;
  const ok = validateImport(JSON.stringify(serializeState(s)), createState);
  assert.equal(ok.ok, true);
  assert.equal(ok.version, SAVE_VERSION);
  const old = serializeState(createState());
  old.version = 9;
  delete old.hq;
  assert.equal(validateImport(JSON.stringify(old), createState).ok, true);
  assert.deepEqual(validateImport('{nope', createState), { ok: false, reason: 'invalid' });
  assert.deepEqual(validateImport('[1,2]', createState), { ok: false, reason: 'invalid' });
  assert.deepEqual(validateImport('null', createState), { ok: false, reason: 'invalid' });
  const future = serializeState(createState());
  future.version = SAVE_VERSION + 1;
  assert.equal(validateImport(JSON.stringify(future), createState).ok, false);
});

test('import preselects an empty slot, else the current one', () => {
  assert.equal(defaultImportSlot({ slots: { 1: {}, 2: {} } }, 1), 3);
  assert.equal(defaultImportSlot({ slots: { 1: {}, 2: {}, 3: {} } }, 2), 2);
  assert.equal(defaultImportSlot({ slots: {} }, 2), 1);
});

test('export file name follows runecraft-slotN-lvX.json', () => {
  assert.equal(exportFileName(1, 31), 'runecraft-slot1-lv31.json');
  assert.equal(exportFileName(3, undefined), 'runecraft-slot3-lv1.json');
});

test('card formatting', () => {
  assert.equal(formatPlaytime(41 * 3600 + 12 * 60 + 5), '41h 12m');
  assert.equal(formatAgo(0), 'Never saved');
  assert.equal(formatAgo(1000, 1000 + 3 * 60_000), 'Last saved 3 min ago');
  assert.equal(formatAgo(0 + 1, 1 + 2 * 86_400_000), 'Last saved 2 days ago');
});
