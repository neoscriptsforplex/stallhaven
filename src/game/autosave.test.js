import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, startCraftBatch } from './economy.js';
import { AUTOSAVE_KEY, loadAutosave, readAutosave, startAutosave, writeAutosave } from './autosave.js';

function memoryStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map,
  };
}

test('autosave round-trips the shop and keeps crafts as time left', () => {
  const store = memoryStore();
  const a = createState();
  a.gold = 1234;
  a.chest.air_rune = 3;
  const queued = startCraftBatch(a, 'air_rune', 2, 100);
  assert.ok(queued >= 1);
  assert.ok(writeAutosave(a, 101.5, store));
  assert.ok(store.map.has(AUTOSAVE_KEY));
  const b = createState();
  assert.ok(loadAutosave(b, 500, store));
  assert.equal(b.gold, a.gold);
  assert.equal(b.chest.air_rune, 3);
  assert.ok(b.crafts.air_rune);
  assert.equal(b.crafts.air_rune.left, queued);
  assert.ok(Math.abs((500 - b.crafts.air_rune.startedAt) - 1.5) < 1e-9);
});

test('no autosave leaves a new shop alone', () => {
  const store = memoryStore();
  const s = createState();
  assert.equal(loadAutosave(s, 0, store), false);
  assert.equal(s.gold, createState().gold);
});

test('a broken autosave is ignored', () => {
  const store = memoryStore();
  store.setItem(AUTOSAVE_KEY, '{nope');
  assert.equal(readAutosave(store), null);
  assert.equal(loadAutosave(createState(), 0, store), false);
});

test('paused autosave does not write (co-op guests)', () => {
  const store = memoryStore();
  const s = createState();
  const saver = startAutosave(s, { store, clock: { now: () => 0 }, intervalMs: 1e9, target: {} });
  saver.pause();
  assert.equal(saver.saveNow(), false);
  assert.equal(store.map.size, 0);
  saver.resume();
  assert.equal(saver.saveNow(), true);
  saver.stop();
});
