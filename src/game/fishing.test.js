import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  FISH_DURATION, FISH_YIELDS, MATERIALS, RECIPES, CHOP_DURATION, fishTiming, fishYield, isFishMaterial,
} from './catalog.js';
import { SAVE_VERSION, applyState, createState, grantCaughtFish, serializeState } from './economy.js';
import {
  FISHING_LEVELS, GATHER_NODES, createSkills, gatherBlockText, meetsGatherLevel, xpForFish, xpForLevel,
} from './skills.js';
import {
  FISHING_SPOTS, MATERIAL_CAP, POND, POND_DOCK, characterGroundY, fishingSpotById, footprintBox, gardenBox,
  playerWalkFloors, pointInPond, pointOnDock, farmingPatchPoseKept, patchHitsTreeOrRock, rectHitsPond, pondWaterBlocks,
} from './layout.js';
import { findPath, gardenObstacles, isWalkable } from './nav.js';
import { resolveStationUse } from './interact.js';
import { attachPondWater } from './pondWater.js';

const FISH = ['raw_shrimp', 'raw_salmon', 'raw_lobster', 'raw_monkfish', 'raw_shark', 'raw_anglerfish'];

describe('fishing skill', () => {
  it('gates the pond spots on the OSRS levels this game has fish for', () => {
    assert.deepEqual(FISH.map((id) => FISHING_LEVELS[id]), [1, 30, 40, 62, 76, 80]);
    for (const id of FISH) {
      const node = GATHER_NODES.find((item) => item.id === id);
      assert.equal(node?.skill, 'fishing', id);
      assert.ok(xpForFish(id) > 0, id);
    }
    assert.ok(FISH.every((id, i) => i === 0 || xpForFish(id) > xpForFish(FISH[i - 1])), 'xp rises by tier');
    assert.equal(xpForFish('logs'), 0);
  });

  it('starts at level 1 with shrimp open and the rest locked', () => {
    const state = { skills: createSkills() };
    assert.equal(state.skills.getLevel('fishing'), 1);
    assert.equal(meetsGatherLevel(state, 'raw_shrimp'), true);
    assert.equal(meetsGatherLevel(state, 'raw_salmon'), false);
    assert.equal(meetsGatherLevel(state, 'raw_lobster'), false);
    assert.equal(gatherBlockText('raw_anglerfish'), 'You need a Fishing level of 80 to fish here.');
    state.skills.addXp('fishing', 13_034_431);
    for (const id of FISH) assert.equal(meetsGatherLevel(state, id), true);
  });

  it('uses the gathering bar length and grants one fish per catch', () => {
    assert.equal(FISH_DURATION, CHOP_DURATION);
    assert.deepEqual(FISH.map(fishYield), [1, 1, 1, 1, 1, 1]);
    assert.deepEqual(fishTiming('raw_shark'), { duration: FISH_DURATION, yield: 1 });
    assert.equal(FISH_YIELDS.raw_shrimp, 1);
    for (const id of FISH) assert.equal(isFishMaterial(id), true);
    assert.equal(isFishMaterial('logs'), false);
  });

  it('banks caught fish as capped, non-restocking materials', () => {
    const state = createState();
    for (const id of FISH) {
      assert.equal(MATERIALS[id].fished, true);
      assert.equal(MATERIALS[id].restock, 0);
      assert.equal(state.materials[id], 0, id);
    }
    assert.equal(MATERIALS.fish, undefined);
    state.materials.raw_shrimp = 0;
    assert.equal(grantCaughtFish(state, 'raw_shrimp'), 1);
    assert.equal(grantCaughtFish(state, 'raw_shrimp'), 1);
    assert.equal(state.materials.raw_shrimp, 2);
    state.materials.raw_shrimp = MATERIAL_CAP - 1;
    assert.equal(grantCaughtFish(state, 'raw_shrimp'), 1);
    assert.equal(state.materials.raw_shrimp, MATERIAL_CAP);
    assert.equal(grantCaughtFish(state, 'raw_shrimp'), 0);
    assert.equal(grantCaughtFish(state, 'logs', 3), 0);
  });
});

describe('cooking needs the matching raw fish', () => {
  it('maps each fish dish to one raw fish', () => {
    assert.deepEqual(RECIPES.shrimp.cost.materials, { raw_shrimp: 1 });
    assert.equal(RECIPES.shrimp.requires.level, 1);
    assert.equal(RECIPES.shrimp.requires.skill, 'cooking');
    assert.deepEqual(RECIPES.shrimp.buyers, RECIPES.salmon.buyers);
    assert.ok(RECIPES.shrimp.price < RECIPES.salmon.price);
    assert.equal(RECIPES.salmon.requires.level, 25);
    assert.equal(RECIPES.lobster.requires.level, 40);
    assert.equal(RECIPES.monkfish.requires.level, 62);
    assert.equal(RECIPES.shark.requires.level, 80);
    assert.ok(RECIPES.shrimp.lineIndex < RECIPES.salmon.lineIndex);
    assert.deepEqual(RECIPES.salmon.cost.materials, { raw_salmon: 1 });
    assert.deepEqual(RECIPES.lobster.cost.materials, { raw_lobster: 1 });
    assert.deepEqual(RECIPES.monkfish.cost.materials, { raw_monkfish: 1 });
    assert.deepEqual(RECIPES.shark.cost.materials, { raw_shark: 1 });
    assert.deepEqual(RECIPES.anglerfish.cost.materials, { raw_anglerfish: 1 });
    assert.equal(RECIPES.fish_pie.cost.materials.raw_salmon, 1);
    assert.deepEqual(RECIPES.curry.cost.materials, { harralander: 1 }, 'curry needs Harralander and no fish');
    for (const recipe of Object.values(RECIPES)) assert.equal(recipe.cost?.materials?.fish, undefined, recipe.id);
  });
});

describe('save v13 fish migration', () => {
  it('moves old generic fish onto raw salmon and keeps bow strings', () => {
    assert.equal(SAVE_VERSION, 15);
    const saved = serializeState(createState());
    saved.version = 12;
    delete saved.materials.raw_salmon; // v12 saves had no raw fish
    saved.materials.fish = 7;
    saved.materials.bow_string = 4;
    const next = createState();
    assert.equal(applyState(next, saved), true);
    assert.equal(next.materials.raw_salmon, 7, 'old fish replace, not add to, the starting salmon');
    assert.equal(next.materials.bow_string, 4);
    assert.equal(next.materials.fish, undefined);
  });

  it('gives an old save without fish no free salmon', () => {
    const saved = serializeState(createState());
    saved.version = 12;
    delete saved.materials.fish;
    delete saved.materials.raw_salmon;
    const next = createState();
    applyState(next, saved);
    assert.equal(next.materials.raw_salmon, 0);
  });

  it('leaves a current save alone', () => {
    const state = createState();
    state.materials.raw_shark = 3;
    const next = createState();
    applyState(next, serializeState(state));
    assert.equal(next.materials.raw_shark, 3);
    assert.equal(next.materials.raw_salmon, 0, 'fish only come from fishing');
    assert.equal(next.materials.raw_shrimp, 0);
    assert.equal(next.skills.getLevel('fishing'), 1, 'a current save is not lifted');
  });

  it('lifts an old save to the new fish levels it already had', () => {
    const saved = serializeState(createState());
    saved.version = 14;
    saved.materials.raw_salmon = 9;
    saved.materials.raw_shark = 2;
    saved.skills.xp.fishing = xpForLevel(20);
    saved.skills.xp.cooking = xpForLevel(10);
    const next = createState();
    applyState(next, saved);
    assert.equal(next.materials.raw_salmon, 9);
    assert.equal(next.materials.raw_shark, 2);
    assert.equal(next.materials.raw_shrimp, 0);
    assert.ok(next.skills.getLevel('fishing') >= 40, 'lobster was open at 20');
    assert.ok(next.skills.getLevel('fishing') < 62, 'monkfish was still locked');
    assert.ok(next.skills.getLevel('cooking') >= 25);
    const low = serializeState(createState());
    low.version = 14;
    low.skills.xp.cooking = xpForLevel(9);
    const stayed = createState();
    applyState(stayed, low);
    assert.equal(stayed.skills.getLevel('cooking'), 9);
    assert.ok(stayed.skills.getLevel('fishing') >= 30, 'salmon was open to every old save');
  });
});

describe('pond layout', () => {
  it('sits on the front-right lawn, clear of every expansion room', () => {
    assert.ok(POND.x > 0, 'right of the shop (+X)');
    const all = footprintBox(['back-left', 'back', 'back-right', 'left', 'right']);
    const grass = gardenBox([]);
    assert.ok(POND.z - POND.rz > all.maxZ + 2, 'in front of the widest footprint');
    assert.ok(POND.x + POND.rx < grass.maxX, 'on the base lawn');
    assert.ok(POND.z + POND.rz < grass.maxZ, 'on the base lawn');
  });

  it('puts every spot in the water and every stand on walkable grass or dock', () => {
    const obstacles = gardenObstacles([]);
    const floors = playerWalkFloors([]);
    for (const spot of FISHING_SPOTS) {
      assert.equal(pointInPond(spot.x, spot.z), true, spot.id);
      assert.equal(pointInPond(spot.stand.x, spot.stand.z) && !pointOnDock(spot.stand.x, spot.stand.z), false, spot.id);
      assert.equal(isWalkable(spot.stand.x, spot.stand.z, obstacles, 0.28, floors), true, spot.id);
      assert.equal(fishingSpotById(spot.materialId), spot);
    }
    assert.equal(isWalkable(POND.x, POND.z, obstacles, 0.28, floors), false, 'water blocks');
    assert.ok(pondWaterBlocks().length > 4);
  });

  it('keeps farming patches and portals off the pond', () => {
    assert.equal(patchHitsTreeOrRock({ x: POND.x, z: POND.z }, []), 'pond');
    assert.equal(farmingPatchPoseKept({ x: POND.x, z: POND.z }, []), false);
    assert.equal(rectHitsPond(POND.x, POND.z, 0.5, 0.5), true);
    assert.equal(rectHitsPond(-8, 9, 1.44, 1.44), false);
    assert.notEqual(patchHitsTreeOrRock({ x: -9.5, z: 10.5 }, []), 'pond');
  });

  it('raises the player onto the dock', () => {
    const mid = { x: (POND_DOCK.minX + POND_DOCK.maxX) / 2, z: (POND_DOCK.minZ + POND_DOCK.maxZ) / 2 };
    const lawn = characterGroundY(4.5, 11.8, []);
    assert.ok(characterGroundY(POND_DOCK.maxX - 0.05, mid.z, []) > lawn + 0.05);
  });

  it('walks to each stand from the front path and opens there facing the water', () => {
    const obstacles = gardenObstacles([]);
    const floors = playerWalkFloors([]);
    const from = { x: 2.2, z: 7.4 };
    for (const spot of FISHING_SPOTS) {
      const path = findPath(from, spot.stand, obstacles, 0.28, floors) ?? [];
      const end = path[path.length - 1];
      assert.ok(end && Math.hypot(end.x - spot.stand.x, end.z - spot.stand.z) < 0.3, spot.id);
      const pose = { x: spot.x, z: spot.z, materialId: spot.materialId };
      const plan = (a, b) => findPath(a, b, obstacles, 0.28, floors);
      const use = resolveStationUse(from, pose, {}, plan, 'fishing_spot');
      assert.equal(use.action, 'walk', spot.id);
      const here = resolveStationUse(spot.stand, pose, {}, plan, 'fishing_spot');
      assert.equal(here.action, 'open', spot.id);
      assert.equal(here.face, spot.face);
    }
  });
});

describe('pond water fx', () => {
  it('animates and disposes cleanly', () => {
    const root = new THREE.Group();
    const fx = attachPondWater(root, { spots: [{ x: 0, z: 0 }], random: () => 0.5 });
    const sheet = fx.group.getObjectByName('pond-sheet');
    const before = sheet.geometry.attributes.position.array.slice();
    fx.update(0.5);
    const after = sheet.geometry.attributes.position.array;
    assert.ok(after.some((v, i) => v !== before[i]), 'sheet moves');
    assert.ok(sheet.geometry.attributes.normal.array[1] > 0.9, 'faces up');
    fx.update(Number.NaN);
    fx.dispose();
    assert.equal(root.children.length, 0);
  });
});
