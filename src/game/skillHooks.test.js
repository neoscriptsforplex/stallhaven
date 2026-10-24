import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAGE_CLOTH_TIER, RECIPES, SHOP, recipeCost, recipeList, stationForRecipe } from './catalog.js';
import {
  SAWMILL_COST,
  applyState,
  buyExpansion,
  buyFurnace,
  buyFurniture,
  buyStation,
  completeCrafts,
  craftBlockReason,
  createState,
  isUnlocked,
  serializeState,
  startCraft,
} from './economy.js';
import { furnitureBuildParts } from './layout.js';
import {
  GATHER_NODES,
  MINING_LEVELS,
  WOODCUTTING_LEVELS,
  gatherBlockText,
  gatherInspectTitle,
  meetsGatherLevel,
  skillForRecipe,
  xpForBuild,
  xpForChop,
  xpForCraft,
  xpForExpansion,
  xpForLevel,
  xpForMine,
  xpForPick,
} from './skills.js';
import { MELEE_SMITH_LEVELS, nextUnlockLabel } from './skillLevels.js';

function placeStation(state, id) {
  const pose = SHOP[id];
  state.furniture[id] = { x: pose.x, z: pose.z, rot: 0 };
}

function reachLevel(state, skillId, level) {
  const need = xpForLevel(level);
  const have = state.skills.getXp(skillId);
  if (have < need) state.skills.addXp(skillId, need - have);
}

function giveBuildMats(state, id) {
  for (const part of furnitureBuildParts(id)) {
    state.materials[part.id] = (state.materials[part.id] ?? 0) + part.count;
  }
}

function finishCraft(state, recipeId) {
  const recipe = RECIPES[recipeId];
  const req = recipe.requires;
  if (req?.skill) reachLevel(state, req.skill, req.level);
  const station = stationForRecipe(recipe);
  if (station !== 'anvil' && !state.furniture[station] && SHOP[station]) placeStation(state, station);
  const cost = recipeCost(recipe);
  for (const [id, n] of Object.entries(cost.materials)) {
    state.materials[id] = Math.max(state.materials[id] ?? 0, n);
  }
  for (const [id, n] of Object.entries(cost.items ?? {})) {
    state.chest[id] = Math.max(state.chest[id] ?? 0, n);
  }
  const before = state.skills.getXp(req.skill);
  assert.equal(startCraft(state, recipeId, 0), true, recipeId);
  assert.deepEqual(completeCrafts(state, recipe.time), [recipeId]);
  return state.skills.getXp(req.skill) - before;
}

describe('skill xp hooks', () => {
  it('grants the recipe xp when a craft finishes', () => {
    const state = createState();
    assert.equal(finishCraft(state, 'bronze_dagger'), RECIPES.bronze_dagger.xp);
    assert.equal(RECIPES.bronze_dagger.xp, 4);
    assert.equal(state.skills.getLevel('smithing'), 1);

    assert.equal(finishCraft(state, 'air_rune'), 4);
    assert.equal(state.skills.getXp('runecrafting'), 4);

    placeStation(state, 'range');
    state.materials.wheat = 1;
    assert.equal(finishCraft(state, 'pot_of_flour'), 2);
    assert.equal(state.skills.getXp('cooking'), 2);

    assert.equal(finishCraft(state, 'saw_plank'), 4);
    assert.equal(RECIPES.bronze_nails.xp, 3);
    assert.equal(RECIPES.iron_nails.requires.level, 15);
    assert.equal(RECIPES.dragon_nails.xp, 480);
  });

  it('trains the recipe skill, including the cannon and the ancient staff', () => {
    assert.equal(skillForRecipe(RECIPES.ancient_staff, 'anvil'), 'crafting');
    assert.deepEqual(RECIPES.ancient_staff.requires, { skill: 'crafting', level: 92 });
    assert.equal(RECIPES.ancient_staff.xp, 1270);
    assert.equal(xpForCraft(RECIPES.ancient_staff), 1270);

    assert.equal(skillForRecipe(RECIPES.dwarven_multicannon, 'fletch'), 'smithing');
    assert.deepEqual(RECIPES.dwarven_multicannon.requires, { skill: 'smithing', level: 99 });
    assert.equal(RECIPES.dwarven_multicannon.xp, 1790);
    assert.deepEqual(RECIPES.cannonballs.requires, { skill: 'fletching', level: 35 });
    assert.equal(RECIPES.cannonballs.xp, 31);
    assert.deepEqual(RECIPES.pot_of_flour.requires, { skill: 'cooking', level: 1 });

    const state = createState();
    assert.match(craftBlockReason(state, 'ancient_staff'), /Requires level 92 Crafting/);
    placeStation(state, 'fletch');
    assert.match(craftBlockReason(state, 'dwarven_multicannon'), /Requires level 99 Smithing/);
    assert.equal(isUnlocked(state, 'dwarven_multicannon'), false);
  });

  it('locks sawmill planks and pays their construction xp once the level is met', () => {
    const state = createState();
    state.gold = SAWMILL_COST;
    assert.equal(buyStation(state, 'sawmill', { x: 0.35, z: 1.35, rot: 0 }), true);
    assert.equal(isUnlocked(state, 'saw_plank'), true);
    assert.equal(isUnlocked(state, 'saw_oak_plank'), false);
    assert.match(craftBlockReason(state, 'saw_oak_plank'), /Requires level 15 Construction/);
    reachLevel(state, 'construction', 15);
    state.materials.oak_logs = 1;
    assert.equal(finishCraft(state, 'saw_oak_plank'), 8);
    assert.equal(RECIPES.saw_magic_plank.requires.level, 75);
    assert.equal(RECIPES.saw_magic_plank.xp, 320);
  });

  it('grants construction xp for rooms, stations, and paid furniture', () => {
    const rooms = createState();
    rooms.gold = 500000;
    assert.equal(buyExpansion(rooms, 'left'), true);
    assert.equal(rooms.skills.getXp('construction'), xpForExpansion(0));
    assert.equal(rooms.skills.getXp('construction'), 1914);

    const furnace = createState();
    assert.equal(buyFurnace(furnace, { x: -1, z: 0.6, rot: 0 }), true);
    assert.equal(furnace.skills.getXp('construction'), 100);

    const table = createState();
    table.gold = 500;
    giveBuildMats(table, 'table');
    const paid = xpForBuild({ kind: 'item', gp: 500, planks: { plank: 4 } });
    assert.equal(paid, 86);
    assert.equal(buyFurniture(table, 'table', { x: 1.2, z: 0.4, rot: 0 }), true);
    assert.equal(table.skills.getXp('construction'), 86);
    table.freeFurnitureReplace.table = 1;
    const beforeFree = table.skills.getXp('construction');
    assert.equal(buyFurniture(table, 'table', { x: 0.4, z: 0.2, rot: 0 }), true);
    assert.equal(table.skills.getXp('construction'), beforeFree);
  });

  it('locks rocks, trees, and wheat, and keeps level-1 nodes open', () => {
    const state = createState();
    assert.equal(meetsGatherLevel(state, 'logs'), true);
    assert.equal(meetsGatherLevel(state, 'flax'), true);
    assert.equal(meetsGatherLevel(state, 'bronze'), true);
    assert.equal(meetsGatherLevel(state, 'wheat'), false);
    assert.equal(meetsGatherLevel(state, 'oak_logs'), false);
    assert.equal(meetsGatherLevel(state, 'runite'), false);
    assert.equal(xpForPick('flax'), 12);
    assert.equal(xpForPick('wheat'), 15);
    assert.equal(xpForChop('logs'), 11);
    assert.equal(xpForChop('oak_logs'), 24);
    assert.equal(xpForChop('magic_logs'), 456);
    assert.equal(xpForMine('runite'), 505);
    assert.equal(xpForMine('dragon'), 645);
    assert.equal(gatherBlockText('runite'), 'You need a Mining level of 40 to mine this rock.');
    assert.equal(gatherBlockText('oak_logs'), 'You need a Woodcutting level of 15 to chop this Oak tree.');
    assert.equal(gatherBlockText('yew_logs'), 'You need a Woodcutting level of 60 to chop this Yew tree.');
    assert.equal(gatherBlockText('wheat'), 'You need a Farming level of 5 to pick this wheat.');
    assert.equal(gatherInspectTitle('Logs', 'logs'), 'Logs');
    assert.equal(gatherInspectTitle('Oak logs', 'oak_logs'), 'Oak tree · Requires Woodcutting 15');
    assert.match(nextUnlockLabel('mining', 1), /Next unlock: Iron rock \(Lv 5\)/);
    reachLevel(state, 'farming', 5);
    assert.equal(meetsGatherLevel(state, 'wheat'), true);
  });

  it('catches an old save up and leaves a save that already has skills alone', () => {
    const old = createState();
    assert.equal(applyState(old, {
      gold: 40,
      craftCounts: { smelt_bronze: 4, smelt_iron: 2 },
      furniture: {
        anvil: { x: -2.55, z: -2.22, rot: 0 },
        furnace: { x: -1, z: 0.6, rot: 0 },
      },
    }), true);
    assert.equal(old.skills.getXp('mining'), 4 * xpForMine('bronze') + 2 * xpForMine('iron'));
    assert.equal(old.skills.getLevel('smithing'), RECIPES.bronze_pickaxe.requires.level);
    assert.equal(old.skills.getLevel('crafting'), RECIPES.staff.requires.level);
    assert.equal(isUnlocked(old, 'iron_sword'), true);
    assert.equal(isUnlocked(old, 'runite_platebody'), false);
    assert.ok(old.skills.getLevel('smithing') < 99);
    assert.match(old.log[0], /Skills have arrived!/);
    assert.match(old.log[0], /Smithing 7/);
    assert.match(old.log[0], /Crafting 12/);

    const current = createState();
    const saved = serializeState(current);
    saved.skills.xp.smithing = 0;
    saved.craftCounts = { bronze_platebody: 40 };
    const next = createState();
    assert.equal(applyState(next, saved), true);
    assert.equal(next.skills.getLevel('smithing'), 1);
    assert.equal(next.log.some((line) => /Skills have arrived/.test(line)), false);
  });

  it('uses the metal tables for mining, melee smithing, and woodcutting', () => {
    const metals = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'runite', 'dragon'];
    metals.forEach((metal, index) => {
      const node = GATHER_NODES.find((item) => item.id === metal);
      assert.equal(node.level, MINING_LEVELS[metal], metal);
      assert.equal(RECIPES[`${metal}_scimitar`].requires.level, MELEE_SMITH_LEVELS[index], metal);
      assert.equal(RECIPES[`${metal}_platebody`]?.requires.level ?? MELEE_SMITH_LEVELS[index], MELEE_SMITH_LEVELS[index]);
      assert.equal(RECIPES[`${metal}_dagger`].xp, RECIPES[`smelt_${metal}`].xp, `${metal} xp unchanged`);
    });
    assert.equal(RECIPES.dragon_full_helm, undefined);
    assert.equal(RECIPES.bronze_hatchet.requires.level, 2);
    assert.equal(RECIPES.iron_nails.requires.level, 15);
    assert.equal(RECIPES.air_rune.requires.level, 1);
    assert.equal(RECIPES.water_rune.requires.level, 5);
    assert.equal(RECIPES.earth_rune.requires.level, 9);
    assert.equal(RECIPES.fire_rune.requires.level, 14);
    assert.equal(RECIPES.water_rune.xp, 9);
    assert.equal(RECIPES.earth_rune.xp, 6);
    assert.equal(stationForRecipe(RECIPES.water_rune), 'altar-water');
    assert.equal(WOODCUTTING_LEVELS.teak, 35);
    assert.equal(WOODCUTTING_LEVELS.mahogany, 50);
    assert.equal(GATHER_NODES.find((node) => node.id === 'yew_logs').level, 60);
    assert.equal(GATHER_NODES.find((node) => node.id === 'magic_logs').level, 75);
    assert.equal(gatherBlockText('magic_logs'), 'You need a Woodcutting level of 75 to chop this Magic tree.');
  });

  it('charges more cloth on later mage armour tiers', () => {
    assert.deepEqual(MAGE_CLOTH_TIER, [1, 2, 4, 8, 16, 32]);
    assert.equal(recipeCost(RECIPES.wizard_hat).materials.cloth, 1);
    assert.equal(recipeCost(RECIPES.wizard_robe).materials.cloth, 2);
    assert.equal(recipeCost(RECIPES.mystic_robe_top).materials.cloth, 4);
    assert.equal(recipeCost(RECIPES.mystic_robe_bottom).materials.cloth, 2);
    assert.equal(recipeCost(RECIPES.splitbark_hat).materials.cloth, 4);
    assert.equal(recipeCost(RECIPES.battlemage_robe_top).materials.cloth, 16);
    assert.equal(recipeCost(RECIPES.lunar_gloves).materials.cloth, 16);
    assert.equal(recipeCost(RECIPES.ancient_robe_top).materials.cloth, 64);
    assert.equal(recipeCost(RECIPES.ancient_hat).materials.cloth, 32);
    assert.equal(recipeCost(RECIPES.ancient_staff).materials.cloth, 100);
  });

  it('stamps a level and an xp amount on every recipe', () => {
    for (const recipe of recipeList()) {
      assert.equal(typeof recipe.skill, 'string', recipe.id);
      assert.equal(typeof recipe.xp, 'number', recipe.id);
      assert.equal(recipe.requires.skill, recipe.skill, recipe.id);
      assert.ok(recipe.requires.level >= 1 && recipe.requires.level <= 99, recipe.id);
    }
  });
});

describe('xp balance pass', () => it('bread doubled, flour old bread, woodcutting +25%', async () => {
  const { xpForCraft, xpForChop } = await import('./skills.js');
  assert.equal(xpForCraft(RECIPES.bread), 18);
  assert.equal(xpForCraft(RECIPES.pot_of_flour), 2);
  assert.equal(xpForChop('maple_logs'), 103);
}));
