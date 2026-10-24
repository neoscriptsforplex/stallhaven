import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECIPES } from './catalog.js';
import { unlockNamesBetween, unlocksBetween } from './skillLevels.js';
import { groupUnlocks, unlockListHtml } from './unlockGroups.js';
import { SKILL_GUIDES } from './skillGuideData.js';
import { levelUpToastHtml } from './skillsPanel.js';

const root = dirname(fileURLToPath(import.meta.url));

test('top bar and bag use OSRS icon buttons and keep their labels', () => {
  const html = readFileSync(join(root, '../../index.html'), 'utf8');
  for (const n of ['heroes', 'quests', 'skills', 'build', 'help', 'music', 'saves', 'settings']) {
    assert.match(html, new RegExp(`class="osrs-btn" id="${n}-btn" title="[^"]+" aria-label="[^"]+"[^>]*><img class="osrs-ico" src="\\./icons/ui/${n}\\.svg"`));
  }
  assert.match(html, /id="materials-toggle" class="materials-toggle osrs-bag"[^>]*title="Inventory"/);
  assert.match(html, /data-quest-badge/);
});

test('level-up unlocks group into short popup rows', () => {
  const rows = unlocksBetween('smithing', 9, 10);
  assert.deepEqual(rows.map((r) => r.name), unlockNamesBetween('smithing', 9, 10));
  const labels = groupUnlocks(rows, RECIPES).map((g) => `${g.label} ×${g.count}`);
  assert.ok(labels.some((l) => /^Steel (armour|weapons) ×\d+$/.test(l)), labels.join());
  const big = groupUnlocks(unlocksBetween('smithing', 29, 30), RECIPES);
  assert.ok(big.some((g) => g.label === 'Steel bar & nails'));
  const html = levelUpToastHtml({ skillId: 'smithing', name: 'Smithing', level: 30, unlocked: ['x'], unlockHtml: unlockListHtml(big, { max: 1 }) });
  assert.match(html, /has-unlocks/);
  assert.match(html, /\+\d+ more · see the Skills guide/);
  assert.doesNotMatch(html, /New: /);
});

test('crafting guide tabs are Magic, Ranged and Materials', () => {
  const tabs = SKILL_GUIDES.crafting.tabs;
  assert.deepEqual(tabs.map((t) => t.label), ['Magic', 'Ranged', 'Materials']);
  assert.ok(tabs[0].rows.some((r) => /staff/i.test(JSON.stringify(r))));
  assert.equal(tabs[2].rows.length, 3);
});

test('flax pick sits on an unscaled holder like wheat', () => {
  const world = readFileSync(join(root, 'world.js'), 'utf8');
  assert.match(world, /holder\.name = 'flax-holder';[\s\S]*attachFlaxPick\(holder, node\)/);
});
