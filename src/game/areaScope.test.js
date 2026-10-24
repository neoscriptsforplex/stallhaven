import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./world.js', import.meta.url), 'utf8');

test('main-area placed groups are hidden with the shop layer', () => {
  const start = src.indexOf('function setShopLayerVisible(on)');
  assert.ok(start > 0);
  const body = src.slice(start, src.indexOf('function ensureDungeon', start));
  assert.match(body, /patchGroup\.visible = on/);
  assert.match(body, /placedGroup\.visible = on/);
});

test('main-area picks are skipped outside the shop', () => {
  assert.match(src, /if \(sceneMode === 'dungeon'\) return dungeonUsePicks\(\);/);
  assert.match(src, /if \(sceneMode === 'runefield'\) return runeFieldUsePicks\(\);/);
});
