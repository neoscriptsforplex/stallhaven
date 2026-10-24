import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/economy.js';
import { autosaveData } from '../game/autosave.js';
import { createSlotStore, memoryStore, storageBackend } from '../game/saveSlots.js';
import { createCloudSync, decideSlot, sameSave, QUEUE_KEY } from './sync.js';
import { createMemoryCloud } from './memoryBackend.js';
import { buildBackup, needsReminder, slotFromBackup, REMIND_EVERY_MS } from './autobackup.js';
import { cloudConfig } from './config.js';
import { formatSavedAt, deviceLabel } from './cloudUi.js';

let clock = 1_000_000;
const now = () => clock;

async function device(cloud, email = 'luke@example.com', opts = {}) {
  const kv = memoryStore();
  const store = createSlotStore({ backend: storageBackend(kv), now });
  await store.loadMeta();
  const client = cloud.client(email);
  const events = [];
  const sync = createCloudSync({ client, store, kv, deviceId: opts.id ?? 'dev', deviceLabel: opts.label ?? 'Test', now, emit: (t, d) => events.push({ t, ...d }), isLive: opts.isLive });
  await client.verifyCode(email, '123456');
  return { kv, store, client, sync, events };
}

async function save(d, slot, gold, name = 'Shop') {
  clock += 1000;
  const s = createState();
  s.gold = gold;
  await d.store.write(slot, autosaveData(s, 0), name);
}

test('decideSlot covers first sign-in, fast-forwards and conflicts', () => {
  assert.equal(decideSlot({ local: null, cloud: null }), 'none');
  assert.equal(decideSlot({ local: null, cloud: { revision: 1 } }), 'download');
  assert.equal(decideSlot({ local: { savedAt: 5 }, cloud: null }), 'upload');
  assert.equal(decideSlot({ local: { savedAt: 5 }, cloud: { revision: 2 }, sync: null }), 'conflict');
  assert.equal(decideSlot({ local: { savedAt: 5 }, cloud: { revision: 2 }, sync: null, same: true }), 'synced');
  const sync = { revision: 2, syncedAt: 5 };
  assert.equal(decideSlot({ local: { savedAt: 5 }, cloud: { revision: 2 }, sync }), 'synced');
  assert.equal(decideSlot({ local: { savedAt: 9 }, cloud: { revision: 2 }, sync }), 'upload');
  assert.equal(decideSlot({ local: { savedAt: 5 }, cloud: { revision: 3 }, sync }), 'download');
  assert.equal(decideSlot({ local: { savedAt: 9 }, cloud: { revision: 3 }, sync }), 'conflict');
});

test('sameSave ignores savedAt only', () => {
  assert.ok(sameSave({ gold: 1, savedAt: 1 }, { gold: 1, savedAt: 2 }));
  assert.ok(!sameSave({ gold: 1 }, { gold: 2 }));
  assert.ok(!sameSave(null, { gold: 2 }));
});

test('save on device A appears on device B after sign-in', async () => {
  const cloud = createMemoryCloud({ now });
  const a = await device(cloud, 'luke@example.com', { label: 'Windows · Chrome' });
  await save(a, 1, 500, 'Emporium');
  assert.equal(await a.sync.markDirty(1), 'ok');
  assert.equal(a.sync.status(1), 'synced');
  const b = await device(cloud);
  const res = await b.sync.pull();
  assert.deepEqual(res, { 1: 'download', 2: 'none', 3: 'none' });
  assert.equal((await b.store.read(1)).gold, 500);
  assert.equal(b.store.meta.slots['1'].name, 'Emporium');
  assert.equal(b.sync.status(1), 'synced');
});

test('one-sided changes fast-forward silently in both directions', async () => {
  const cloud = createMemoryCloud({ now });
  const a = await device(cloud);
  const b = await device(cloud);
  await save(a, 2, 10);
  await a.sync.markDirty(2);
  await b.sync.pull();
  await save(b, 2, 20);
  await b.sync.markDirty(2);
  assert.deepEqual(await a.sync.pull(), { 1: 'none', 2: 'download', 3: 'none' });
  assert.equal((await a.store.read(2)).gold, 20);
  assert.deepEqual(await b.sync.pull(), { 1: 'none', 2: 'synced', 3: 'none' });
});

test('both sides changed → conflict; Continue stays blocked until resolved (keep cloud)', async () => {
  const cloud = createMemoryCloud({ now });
  const a = await device(cloud);
  const b = await device(cloud);
  await save(a, 1, 100);
  await a.sync.markDirty(1);
  await b.sync.pull();
  await save(a, 1, 111);
  await a.sync.markDirty(1);
  await save(b, 1, 222);
  assert.equal(await b.sync.markDirty(1), 'ok');
  assert.equal(b.sync.status(1), 'conflict');
  assert.ok(b.events.some((e) => e.t === 'cloud_conflict' && e.slot === 1));
  assert.equal(b.sync.conflict(1).cloud.data.gold, 111);
  // Later saves on B don't upload while in conflict.
  await save(b, 1, 333);
  assert.equal(await b.sync.markDirty(1), 'conflict');
  assert.equal([...cloud.rows.values()][0].data.gold, 111);
  assert.deepEqual(await b.sync.resolve(1, 'cloud'), { ok: true });
  assert.equal((await b.store.read(1)).gold, 111);
  assert.equal(b.sync.status(1), 'synced');
});

test('keep this device overwrites the cloud; keep both copies cloud into an empty slot', async () => {
  const cloud = createMemoryCloud({ now });
  const a = await device(cloud);
  const b = await device(cloud);
  await save(a, 1, 1);
  await save(b, 1, 2);
  await a.sync.markDirty(1);
  await b.sync.pull();
  assert.equal(b.sync.status(1), 'conflict', 'first sign-in with different saves');
  const r = await b.sync.resolve(1, 'both');
  assert.deepEqual(r, { ok: true, copySlot: 2 });
  assert.equal((await b.store.read(1)).gold, 2);
  assert.equal((await b.store.read(2)).gold, 1);
  assert.equal(b.store.meta.slots['2'].name, 'Shop (cloud copy)');
  assert.equal(b.store.meta.lastSlot, 1, 'the copy does not become last played');
  const rows = Object.fromEntries([...cloud.rows.values()].map((x) => [x.slot, x.data.gold]));
  assert.deepEqual(rows, { 1: 2, 2: 1 });
  // A now sees its slot 1 replaced (it hadn't changed) and slot 2 as new.
  assert.deepEqual(await a.sync.pull(), { 1: 'download', 2: 'download', 3: 'none' });
  // keep this device
  await save(a, 3, 7);
  await save(b, 3, 8);
  await a.sync.markDirty(3);
  await b.sync.markDirty(3);
  assert.equal(b.sync.status(3), 'conflict');
  await b.sync.resolve(3, 'local');
  assert.equal([...cloud.rows.values()].find((x) => x.slot === 3).data.gold, 8);
});

test('keep both is refused when no slot is empty', async () => {
  const cloud = createMemoryCloud({ now });
  const a = await device(cloud);
  const b = await device(cloud);
  for (const n of [1, 2, 3]) await save(a, n, n);
  for (const n of [1, 2, 3]) await a.sync.markDirty(n);
  for (const n of [1, 2, 3]) await save(b, n, n * 10);
  await b.sync.pull();
  assert.deepEqual(b.sync.conflictSlots().sort(), [1, 2, 3]);
  assert.deepEqual(await b.sync.resolve(1, 'both'), { ok: false });
});

test('the running slot never gets swapped silently', async () => {
  const cloud = createMemoryCloud({ now });
  const a = await device(cloud);
  const b = await device(cloud, 'luke@example.com', { isLive: (slot) => slot === 1 });
  await save(a, 1, 5);
  await a.sync.markDirty(1);
  await b.sync.pull(); // empty locally → download is fine
  await save(a, 1, 6);
  await a.sync.markDirty(1);
  assert.deepEqual(await b.sync.pull(), { 1: 'conflict', 2: 'none', 3: 'none' });
});

test('offline saves queue up and flush when back online', async () => {
  const cloud = createMemoryCloud({ now });
  const a = await device(cloud);
  cloud.setOffline(true);
  await save(a, 1, 42);
  assert.equal(await a.sync.markDirty(1), 'offline');
  assert.ok(a.sync.offline);
  assert.deepEqual(JSON.parse(a.kv.getItem(QUEUE_KEY)).up, [1]);
  await a.sync.markDeleted(2);
  cloud.setOffline(false);
  await a.sync.flush();
  assert.equal(a.sync.offline, false);
  assert.deepEqual(a.sync.queue, { up: [], del: [] });
  assert.equal([...cloud.rows.values()][0].data.gold, 42);
});

test('deleting a slot removes it from the cloud', async () => {
  const cloud = createMemoryCloud({ now });
  const a = await device(cloud);
  await save(a, 1, 1);
  await a.sync.markDirty(1);
  await a.store.remove(1);
  await a.sync.markDeleted(1);
  assert.equal(cloud.rows.size, 0);
});

test('users only see their own saves', async () => {
  const cloud = createMemoryCloud({ now });
  const a = await device(cloud, 'a@example.com');
  const b = await device(cloud, 'b@example.com');
  await save(a, 1, 1);
  await a.sync.markDirty(1);
  assert.deepEqual(await b.sync.pull(), { 1: 'none', 2: 'none', 3: 'none' });
});

test('sign out keeps local saves unless asked to remove them', async () => {
  const cloud = createMemoryCloud({ now });
  const a = await device(cloud);
  await save(a, 1, 1);
  await a.sync.signOut();
  assert.equal(a.sync.signedIn, false);
  assert.ok(await a.store.read(1));
  assert.equal(await a.sync.markDirty(1), null, 'no sync when signed out');
  const b = await device(cloud);
  await save(b, 2, 2);
  await b.sync.signOut({ removeLocal: true });
  assert.equal(await b.store.read(2), null);
});

test('paused (co-op guest) never syncs', async () => {
  const cloud = createMemoryCloud({ now });
  const a = await device(cloud);
  a.sync.setPaused(true);
  await save(a, 1, 1);
  assert.equal(await a.sync.markDirty(1), null);
  assert.equal(await a.sync.pull(), null);
  assert.equal(cloud.rows.size, 0);
});

test('backup file holds all slots; weekly reminder', async () => {
  const cloud = createMemoryCloud({ now });
  const a = await device(cloud);
  await save(a, 1, 9, 'One');
  await save(a, 3, 3, 'Three');
  const b = await buildBackup(a.store, 0);
  assert.equal(b.kind, 'stallhaven-backup');
  assert.deepEqual(Object.keys(b.slots), ['1', '3']);
  assert.equal(slotFromBackup(b, 1).gold, 9);
  assert.equal(slotFromBackup({}, 1), null);
  assert.equal(needsReminder({ lastDownloadAt: 0, hasSaves: true }), true);
  assert.equal(needsReminder({ lastDownloadAt: 0, hasSaves: false }), false);
  assert.equal(needsReminder({ lastDownloadAt: 1000, now: 1000 + REMIND_EVERY_MS - 1, hasSaves: true }), false);
  assert.equal(needsReminder({ lastDownloadAt: 1000, now: 1000 + REMIND_EVERY_MS, hasSaves: true }), true);
});

test('online saves stay off unless both env vars are set', () => {
  assert.equal(cloudConfig({}), null);
  assert.equal(cloudConfig({ VITE_SUPABASE_URL: 'http://x' }), null);
  assert.deepEqual(cloudConfig({ VITE_SUPABASE_URL: 'http://x/', VITE_SUPABASE_ANON_KEY: 'k' }), { url: 'http://x', anonKey: 'k' });
});

test('conflict times and device labels', () => {
  const nowMs = new Date(2026, 9, 18, 18, 0).getTime();
  assert.match(formatSavedAt(new Date(2026, 9, 18, 17, 48).getTime(), nowMs), /^Today, 5:48 pm$/);
  assert.match(formatSavedAt(new Date(2026, 9, 16, 21, 14).getTime(), nowMs), /^Fri 16 Oct, 9:14 pm$/);
  assert.equal(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17.0 Mobile Safari/604.1'), 'iPhone · Safari');
  assert.equal(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537'), 'Windows · Chrome');
});

test('cloud config falls back to meta tags', () => {
  const doc = { querySelector: (sel) => ({ getAttribute: () => (sel.includes('url') ? 'https://abc.supabase.co/' : 'anon-key') }) };
  assert.deepEqual(cloudConfig(undefined, doc), { url: 'https://abc.supabase.co', anonKey: 'anon-key' });
  const empty = { querySelector: () => null };
  assert.equal(cloudConfig(undefined, empty), null);
});

test('the whole current save format (v14, construction) survives a sync round-trip', async () => {
  const { serializeState, applyState, SAVE_VERSION } = await import('../game/economy.js');
  const cloud = createMemoryCloud({ now });
  const a = await device(cloud);
  const s = createState();
  s.gold = 77;
  const data = autosaveData(s, 0);
  assert.equal(data.version, SAVE_VERSION);
  clock += 1000;
  await a.store.write(1, data, 'Full');
  await a.sync.markDirty(1);
  const b = await device(cloud);
  await b.sync.pull();
  const got = await b.store.read(1);
  const back = createState();
  assert.ok(applyState(back, got));
  const strip = (x) => { const { shopName: _n, ...r } = serializeState(x); return r; };
  assert.deepEqual(strip(back), strip(s));
  assert.ok('furniture' in got);
});

test('a save from a newer game version is never downloaded or overwritten', async () => {
  const cloud = createMemoryCloud({ now });
  const a = await device(cloud);
  const data = autosaveData(createState(), 0);
  data.version = 999;
  clock += 1000;
  await a.store.write(1, data, 'Future');
  await a.sync.markDirty(1);
  const kv = memoryStore();
  const store = createSlotStore({ backend: storageBackend(kv), now });
  await store.loadMeta();
  const client = cloud.client('luke@example.com');
  await client.verifyCode('luke@example.com', '1');
  const old = createCloudSync({ client, store, kv, now, saveVersion: 14 });
  assert.deepEqual(await old.pull(), { 1: 'newer-version', 2: 'none', 3: 'none' });
  assert.equal(await store.read(1), null);
});
