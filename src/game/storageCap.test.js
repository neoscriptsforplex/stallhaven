import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATERIALS, RECIPES } from './catalog.js';
import {
  completeCrafts,
  craftBlockReason,
  gatherFullMessage,
  grantChoppedLogs,
  grantFountainWater,
  grantMinedMaterial,
  grantPickedFlax,
  materialIsFull,
  maxCraftActions,
  miningBarAmount,
  storageCap,
  tickMaterials,
  createState,
} from './economy.js';
import { QUEST_BY_ID } from './heroesQuests.js';
import { materialsDrawerHtml } from './materialsDrawer.js';
import { xpForLevel } from './skills.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('storage cap', () => {
  it('grows with chest level and stops every gather at the cap', () => {
    const state = createState();
    assert.equal(storageCap(state), 250);
    state.materials.logs = 248;
    assert.equal(grantChoppedLogs(state), 2);
    assert.equal(grantChoppedLogs(state), 0);
    assert.equal(state.materials.logs, 250);
    assert.equal(gatherFullMessage('logs'), 'Logs full.');
    assert.equal(gatherFullMessage('water'), 'Bucket of water full.');
    assert.equal(gatherFullMessage('flax'), 'Flax full.');
    state.materials.flax = 250;
    assert.equal(grantPickedFlax(state), 0);
    state.materials.water = 250;
    assert.equal(grantFountainWater(state), 0);
    state.materials.bronze = 250;
    assert.equal(miningBarAmount(state, 'bronze'), 0);
    assert.equal(grantMinedMaterial(state, 'bronze'), 0);
    state.chestLevel = 2;
    assert.equal(storageCap(state), 500);
    assert.equal(materialIsFull(state, 'logs'), false);
    assert.equal(miningBarAmount(state, 'bronze'), 5);
    assert.equal(grantMinedMaterial(state, 'bronze'), 5);
    assert.equal(state.materials.bronze, 255);
    state.materials.logs = 500;
    assert.equal(grantChoppedLogs(state), 0);
    assert.equal(gatherFullMessage('logs'), 'Logs full.');
  });

  it('restocks only up to the chest cap', () => {
    const state = createState();
    state.materials.hide = 250;
    state.materialAcc = {};
    tickMaterials(state, 80);
    assert.equal(state.materials.hide, 250);
    state.chestLevel = 2;
    tickMaterials(state, 8);
    assert.ok(state.materials.hide > 250);
    assert.ok(state.materials.hide <= 500);
  });

  it('blocks a material craft at the cap and refunds a batch that no longer fits', () => {
    const state = createState();
    state.skills.addXp('crafting', xpForLevel(10));
    state.furniture.wheel = { x: 0, z: 0, rot: 0 };
    state.materials.flax = 10;
    state.materials.bow_string = 250;
    assert.equal(craftBlockReason(state, 'spin_bow_string'), 'Storage full.');
    assert.equal(maxCraftActions(state, 'spin_bow_string'), 0);
    state.materials.bow_string = 249;
    assert.equal(craftBlockReason(state, 'spin_bow_string'), null);
    assert.equal(maxCraftActions(state, 'spin_bow_string'), 1);
    state.materials.bow_string = 250;
    state.crafts.spin_bow_string = { startedAt: 0, duration: 1, left: 3, total: 3 };
    assert.deepEqual(completeCrafts(state, 10), []);
    assert.equal(state.materials.bow_string, 250);
    assert.equal(state.crafts.spin_bow_string, undefined);
    assert.equal(state.materials.flax, 13);
  });

  it('marks a full drawer row and prices dragonhide from coloured hides', () => {
    const html = materialsDrawerHtml({ logs: 250, flax: 3 }, 250);
    assert.match(html, /materials-row is-full/);
    assert.match(html, /data-storage-full="logs"/);
    assert.match(html, />FULL</);
    assert.doesNotMatch(html, /data-storage-full="flax"/);
    assert.doesNotMatch(materialsDrawerHtml({ logs: 249 }, 250), /is-full/);
    assert.doesNotMatch(materialsDrawerHtml({ logs: 250 }, 500), /FULL/);
    for (const id of ['green_dhide', 'blue_dhide', 'red_dhide', 'black_dhide']) {
      assert.equal(MATERIALS[id].quest, true, id);
      assert.equal(MATERIALS[id].restock, 0, id);
      assert.equal(MATERIALS[id].start, 0, id);
    }
    assert.deepEqual(RECIPES.green_dhide_body.cost.materials, { green_dhide: 1 });
    assert.deepEqual(RECIPES.blue_dragon_mask.cost.materials, { blue_dhide: 1 });
    assert.deepEqual(RECIPES.red_dhide_chaps.cost.materials, { red_dhide: 1 });
    assert.deepEqual(RECIPES.black_dhide_boots.cost.materials, { black_dhide: 1 });
    assert.equal(RECIPES.green_dhide_body.cost.gold, 0);
    assert.equal(RECIPES.blue_dhide_body.cost.gold, 2);
    assert.equal(RECIPES.blue_dhide_body.tint, 0x5b8ee6);
    assert.equal(RECIPES.black_dragon_mask.tint, 0x6a6a72);
    assert.equal(QUEST_BY_ID.black_dragon.tint, '#1c1c1c');
    assert.equal(RECIPES.green_dhide_body.cost.materials.hide, undefined);
  });

  it('stops a finished chop or mine instead of restarting the bar', () => {
    const world = readFileSync(join(root, 'src/game/world.js'), 'utf8');
    const hud = readFileSync(join(root, 'src/game/hud.js'), 'utf8');
    const tick = world.slice(world.indexOf('function tickMining'), world.indexOf('function shortestYawDelta'));
    assert.match(tick, /gatherFullMessage\('water'\)/);
    assert.match(tick, /gatherFullMessage\(field\.materialId\)/);
    assert.match(tick, /if \(got <= 0\) \{[\s\S]*?gatherFullMessage\(mining\.materialId\)[\s\S]*?stopMining\(\);\s*return;\s*\}/);
    assert.match(world, /function refuseFull\(materialId\)/);
    assert.match(world, /startTreeTopple\(fallingTree, now\)\) topplingTrees\.add/);
    assert.match(world, /tickTopples\(now\)/);
    assert.match(hud, /data-storage-upgrade/);
    assert.match(hud, /title="Storage full"/);
    assert.match(hud, /materialsDrawerHtml\(state\.materials, storageCap\(state\)\)/);
    assert.doesNotMatch(hud, /Save\/Load listeners|saveStateToFile/);
  });
});
