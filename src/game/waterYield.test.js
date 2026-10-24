import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOUBLE_WATER_LEVEL, waterYieldFor } from './skills.js';
import { unlocksBetween } from './skillLevels.js';
import { SKILL_GUIDES } from './skillGuideData.js';
import { FOUNTAIN_WATER_YIELD } from './catalog.js';

test('one bucket per fill below farming 25, two from 25', () => {
  assert.equal(FOUNTAIN_WATER_YIELD, 1);
  assert.equal(DOUBLE_WATER_LEVEL, 25);
  assert.equal(waterYieldFor(1), 1);
  assert.equal(waterYieldFor(24), 1);
  assert.equal(waterYieldFor(25), 2);
  assert.equal(waterYieldFor(99), 2);
});

test('farming 25 unlock shows in level-up rows and the guide', () => {
  assert.ok(unlocksBetween('farming', 24, 25).some((r) => r.name === '2 buckets of water per fill'));
  const rows = SKILL_GUIDES.farming.tabs.flatMap((t) => t.rows);
  assert.ok(rows.some((r) => r.lv === 25 && r.desc === '2 buckets of water per fill'));
});
