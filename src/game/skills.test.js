import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSkills,
  levelForXp,
  MAX_XP,
  progressForXp,
  SKILL_IDS,
  skillForRecipe,
  xpForCraft,
  xpForBuild,
  xpForSaw,
  xpForExpansion,
  xpForLevel,
  xpForMine,
  xpFromCraftHistory,
} from './skills.js';

test('OSRS curve matches known values', () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 83);
  assert.equal(xpForLevel(10), 1154);
  assert.equal(xpForLevel(50), 101333);
  assert.equal(xpForLevel(92), 6517253);
  assert.equal(xpForLevel(99), 13034431);
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(82), 1);
  assert.equal(levelForXp(83), 2);
  assert.equal(levelForXp(13034430), 98);
  assert.equal(levelForXp(13034431), 99);
  assert.equal(levelForXp(MAX_XP), 99);
});

test('ten skills, all start at level 1', () => {
  const skills = createSkills();
  assert.equal(SKILL_IDS.length, 10);
  assert.equal(skills.getTotalLevel(), 10);
  for (const id of SKILL_IDS) assert.equal(skills.getLevel(id), 1);
});

test('addXp grants, ignores junk and fires level-up once per gain', () => {
  const skills = createSkills();
  const ups = [];
  skills.onLevelUp((e) => ups.push(e));
  assert.equal(skills.addXp('nope', 50), 0);
  assert.equal(skills.addXp('mining', -5), 0);
  assert.equal(skills.addXp('mining', Number.NaN), 0);
  assert.equal(skills.addXp('mining', 82), 82);
  assert.equal(ups.length, 0);
  skills.addXp('mining', 1);
  assert.equal(ups.length, 1);
  assert.deepEqual([ups[0].skillId, ups[0].from, ups[0].level], ['mining', 1, 2]);
  skills.addXp('mining', 1154);
  assert.equal(ups[1].from, 2);
  assert.equal(ups[1].level, 10);
  assert.equal(ups[1].levelsGained, 8);
  assert.equal(skills.getTotalLevel(), 19);
});

test('xp caps at 200m', () => {
  const skills = createSkills();
  skills.addXp('cooking', MAX_XP + 10);
  assert.equal(skills.getXp('cooking'), MAX_XP);
  assert.equal(skills.addXp('cooking', 5), 0);
  assert.equal(skills.getProgress('cooking').t, 1);
  assert.equal(skills.getProgress('cooking').nextLevelXp, null);
});

test('progress mid level', () => {
  const p = progressForXp(100);
  assert.equal(p.level, 2);
  assert.equal(p.nextLevelXp, 174);
  assert.equal(p.toNext, 74);
  assert.ok(p.t > 0.18 && p.t < 0.19);
});

test('toJSON / fromJSON round trip keeps listeners', () => {
  const skills = createSkills();
  let ups = 0;
  skills.onLevelUp(() => { ups += 1; });
  skills.addXp('smithing', 5000);
  const saved = JSON.parse(JSON.stringify(skills.toJSON()));
  const other = createSkills(saved);
  assert.equal(other.getXp('smithing'), 5000);
  skills.fromJSON({ xp: { smithing: 'junk', cooking: 200, bogus: 9 } });
  assert.equal(skills.getXp('smithing'), 0);
  assert.equal(skills.getXp('cooking'), 200);
  assert.equal(skills.toJSON().xp.bogus, undefined);
  skills.fromJSON(undefined);
  assert.equal(skills.getTotalLevel(), 10);
  const before = ups;
  skills.addXp('cooking', 100);
  assert.equal(ups, before + 1);
});

test('recipe to skill mapping', () => {
  assert.equal(skillForRecipe({ category: 'rune', tier: 1 }, 'anvil'), 'runecrafting');
  assert.equal(skillForRecipe({ category: 'weapon' }, 'anvil'), 'smithing');
  assert.equal(skillForRecipe({ category: 'smelt' }, 'furnace'), 'smithing');
  assert.equal(skillForRecipe({ category: 'food' }, 'range'), 'cooking');
  assert.equal(skillForRecipe({ category: 'potion' }, 'cauldron'), 'herblore');
  assert.equal(skillForRecipe({ category: 'ammo' }, 'fletch'), 'fletching');
  assert.equal(skillForRecipe({ category: 'spin' }, 'wheel'), 'crafting');
  assert.equal(skillForRecipe({ category: 'potter' }, 'potter'), 'crafting');
  assert.equal(skillForRecipe({ category: 'weave' }, 'loom'), 'crafting');
  assert.equal(skillForRecipe({ category: 'saw' }, 'sawmill'), 'construction');
  assert.equal(skillForRecipe(null, 'anvil'), null);
});

test('suggested xp amounts', () => {
  assert.equal(xpForCraft({ tier: 1 }), 16);
  assert.equal(xpForCraft({ tier: 7 }), 76);
  assert.equal(xpForMine('bronze'), 18);
  assert.equal(xpForMine('wood'), 0);
  assert.equal(xpForExpansion(0), 1914);
  assert.equal(xpForExpansion(4), 13228);
  assert.equal(xpForBuild({ kind: 'item', gp: 500 }), 70);
  assert.equal(xpForBuild({ kind: 'station', gp: 0 }), 100);
  assert.equal(xpForBuild({ kind: 'item', gp: 2000, planks: { oak_plank: 4 } }), 146);
  assert.equal(xpForSaw('oak_plank', 10), 80);
  assert.equal(xpForSaw('nope', 10), 0);
  assert.equal(xpForBuild({ xp: 42 }), 42);
});

test('craft history rebuild', () => {
  const recipes = { a: { category: 'food', tier: 1 }, b: { category: 'rune', tier: 2 } };
  const station = (r) => (r.category === 'food' ? 'range' : 'anvil');
  const out = xpFromCraftHistory({ a: 3, b: 2, missing: 4 }, recipes, station);
  assert.equal(out.xp.cooking, 48);
  assert.equal(out.xp.runecrafting, 52);
});
