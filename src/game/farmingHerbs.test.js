import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GROW_RECIPES,
  HERB_GROW_YIELD,
  MATERIALS,
  RECIPES,
} from './catalog.js';
import {
  SAVE_VERSION,
  applyState,
  buyFurniture,
  createState,
  harvestHerb,
  moveFarmingPatch,
  plantHerb,
  removeFarmingPatch,
  serializeState,
} from './economy.js';
import { QUESTS } from './heroesQuests.js';
import { createIntentBus } from './intents.js';
import {
  FARMING_PATCH_COSTS,
  furnitureBuildParts,
} from './layout.js';
import { xpForLevel } from './skills.js';

const root = dirname(fileURLToPath(import.meta.url));
const POSE = { x: -4.2, z: -8.05, rot: 0 };
const POSE_B = { x: -8.4, z: -8.05, rot: 0.4 };
const HERB_IDS = ['guam', 'marrentill', 'tarromin', 'harralander', 'ranarr', 'lantadyme', 'dwarf_weed'];

function funded() {
  const state = createState();
  state.gold = 80_000_000;
  for (const part of [
    ...furnitureBuildParts('farming_patch', 0),
    ...furnitureBuildParts('farming_patch', 1),
  ]) {
    state.materials[part.id] = (state.materials[part.id] ?? 0) + part.count + 5;
  }
  return state;
}

describe('farming patch move and delete', () => {
  it('refunds the current top tier without clipping, and drops the crop', () => {
    const state = funded();
    assert.equal(buyFurniture(state, 'farming_patch', POSE), true);
    assert.equal(buyFurniture(state, 'farming_patch', POSE_B), true);
    assert.equal(state.boughtFurniture.farming_patch, 2);
    state.furniture.patches[0].crop = { id: 'grow_guam', startedAt: 1, endsAt: 2 };
    state.materials.steel_nails = 250;
    state.materials.willow_plank = 250;
    const gold = state.gold;
    assert.equal(removeFarmingPatch(state, 0), true);
    assert.equal(state.furniture.patches.length, 1);
    assert.equal(state.furniture.patches[0].x, POSE_B.x);
    assert.equal(state.boughtFurniture.farming_patch, 1);
    assert.equal(state.gold, gold + FARMING_PATCH_COSTS[1]);
    assert.equal(state.materials.steel_nails, 258);
    assert.equal(state.materials.willow_plank, 253);
    assert.equal(state.freeFurnitureReplace.farming_patch, 0);
  });

  it('restores a free-credit patch without a refund', () => {
    const state = funded();
    assert.equal(buyFurniture(state, 'farming_patch', POSE), true);
    state.furniture.patches = [];
    state.freeFurnitureReplace.farming_patch = 1;
    assert.equal(buyFurniture(state, 'farming_patch', POSE), true);
    assert.equal(state.furniture.patches[0].paid, false);
    const gold = state.gold;
    const nails = state.materials.iron_nails;
    assert.equal(removeFarmingPatch(state, 0), true);
    assert.equal(state.furniture.patches.length, 0);
    assert.equal(state.gold, gold);
    assert.equal(state.materials.iron_nails, nails);
    assert.equal(state.boughtFurniture.farming_patch, 1);
    assert.equal(state.freeFurnitureReplace.farming_patch, 1);
  });

  it('keeps paid and crop through save and load, and treats a missing paid flag as paid', () => {
    const state = funded();
    assert.equal(buyFurniture(state, 'farming_patch', POSE), true);
    state.furniture.patches[0].crop = { id: 'grow_guam', startedAt: 10, endsAt: 40_000 };
    const loaded = createState();
    assert.equal(applyState(loaded, serializeState(state)), true);
    assert.equal(loaded.furniture.patches[0].paid, true);
    assert.deepEqual(loaded.furniture.patches[0].crop, { id: 'grow_guam', startedAt: 10, endsAt: 40_000 });

    const old = createState();
    assert.equal(applyState(old, {
      furniture: { patches: [{ x: POSE.x, z: POSE.z, rot: 0 }] },
      boughtFurniture: { farming_patch: 1 },
    }), true);
    assert.equal(old.furniture.patches[0].paid, true);
    assert.equal(old.furniture.patches[0].crop, null);
  });

  it('moves the patch and leaves the crop on it', () => {
    const state = funded();
    buyFurniture(state, 'farming_patch', POSE);
    state.furniture.patches[0].crop = { id: 'grow_tarromin', startedAt: 1, endsAt: 9 };
    assert.equal(moveFarmingPatch(state, 0, POSE_B), true);
    assert.equal(state.furniture.patches[0].x, POSE_B.x);
    assert.equal(state.furniture.patches[0].z, POSE_B.z);
    assert.equal(state.furniture.patches[0].rot, POSE_B.rot);
    assert.equal(state.furniture.patches[0].crop.id, 'grow_tarromin');
    assert.equal(state.boughtFurniture.farming_patch, 1);
  });
});

describe('herb patches', () => {
  it('grows on a wall clock and harvests after time has passed offline', () => {
    const state = funded();
    buyFurniture(state, 'farming_patch', POSE);
    assert.equal(plantHerb(state, 0, 'grow_guam', 1_000), false);
    state.skills.addXp('farming', xpForLevel(9));
    assert.equal(plantHerb(state, 0, 'grow_guam', 1_000), true);
    assert.equal(plantHerb(state, 0, 'grow_marrentill', 1_000), false);
    assert.equal(harvestHerb(state, 0, 1_000 + 30_000 - 1), 0);
    assert.ok(state.furniture.patches[0].crop);
    const before = state.skills.getXp('farming');
    const guam = state.materials.guam;
    assert.equal(harvestHerb(state, 0, 1_000 + 30_000), HERB_GROW_YIELD);
    assert.equal(state.materials.guam, guam + HERB_GROW_YIELD);
    assert.equal(state.furniture.patches[0].crop, null);
    assert.equal(state.skills.getXp('farming'), before + GROW_RECIPES[0].xp);
  });

  it('stops a full harvest and still clears a short stack', () => {
    const state = funded();
    buyFurniture(state, 'farming_patch', POSE);
    state.skills.addXp('farming', xpForLevel(9));
    plantHerb(state, 0, 'grow_guam', 0);
    state.materials.guam = 250;
    assert.equal(harvestHerb(state, 0, 30_000), 0);
    assert.equal(state.furniture.patches[0].crop.id, 'grow_guam');
    assert.equal(state.materials.guam, 250);
    state.materials.guam = 249;
    assert.equal(harvestHerb(state, 0, 30_000), 1);
    assert.equal(state.materials.guam, 250);
    assert.equal(state.furniture.patches[0].crop, null);
  });

  it('routes plant and harvest through intents on the wall clock', () => {
    const state = funded();
    buyFurniture(state, 'farming_patch', POSE);
    state.skills.addXp('farming', xpForLevel(9));
    const bus = createIntentBus();
    bus.bind(state);
    assert.equal(bus.run({ type: 'plantHerb', index: 0, recipeId: 'grow_guam' }), true);
    assert.equal(bus.run({ type: 'harvestHerb', index: 0 }), 0);
    assert.ok(state.furniture.patches[0].crop.endsAt > Date.now());
  });

  it('replaces the generic herb with seven real ones', () => {
    assert.equal(SAVE_VERSION, 14);
    assert.equal(MATERIALS.herbs, undefined);
    assert.equal(MATERIALS.guam.start, 8);
    assert.equal(MATERIALS.guam.restock, 0);
    assert.equal(MATERIALS.guam.regenEvery, 0);
    assert.equal(MATERIALS.harralander.start, 0);
    const fresh = createState();
    assert.equal(fresh.materials.guam, 8);
    assert.equal(fresh.materials.tarromin, 0);
    assert.equal(fresh.materials.herbs, undefined);

    const replaced = createState();
    assert.equal(applyState(replaced, { materials: { herbs: 15 } }), true);
    assert.equal(replaced.materials.guam, 15);
    assert.equal(replaced.materials.herbs, undefined);

    const both = createState();
    assert.equal(applyState(both, { materials: { herbs: 4, guam: 2 } }), true);
    assert.equal(both.materials.guam, 6);

    assert.deepEqual(RECIPES.curry.cost.materials, { harralander: 1 });
    assert.deepEqual(RECIPES.attack_potion.cost.materials, { guam: 1, water: 1 });
    assert.deepEqual(RECIPES.strength_potion.cost.materials, { tarromin: 1, water: 1 });
    assert.deepEqual(RECIPES.anti_poison_potion.cost.materials, { marrentill: 1, water: 1 });
    assert.deepEqual(RECIPES.energy_potion.cost.materials, { harralander: 1, water: 1 });
    assert.deepEqual(RECIPES.prayer_potion.cost.materials, { ranarr: 2, water: 1 });
    assert.deepEqual(RECIPES.antifire_potion.cost.materials, { lantadyme: 2, water: 1 });
    assert.deepEqual(RECIPES.ranging_potion.cost.materials, { dwarf_weed: 2, water: 1 });
    assert.deepEqual(RECIPES.magic_potion.cost.materials, { lantadyme: 2, water: 1 });

    const moss = QUESTS.find((quest) => quest.id === 'moss_giant');
    for (const id of HERB_IDS) assert.equal(moss.rewards[id], 10);
  });
});

describe('patch menu wiring', () => {
  it('opens move and delete from the furniture menu and plants from the patch screen', () => {
    const hud = readFileSync(join(root, 'hud.js'), 'utf8');
    const world = readFileSync(join(root, 'world.js'), 'utf8');
    assert.match(hud, /Delete this farming patch/);
    assert.match(hud, /type: 'removePatch'/);
    assert.match(hud, /type: 'movePatch'/);
    assert.match(hud, /data-herb/);
    assert.match(world, /beginMovePatch/);
    assert.match(world, /placeNeedsConfirm = true/);
    assert.match(world, /id: 'farming_patch', index: displayIndex/);
  });
});
