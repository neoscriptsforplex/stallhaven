import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES } from './catalog.js';
import { completeCrafts, craftDoneMessage, craftedOutputCount, createState, grantMinedMaterial, grantPickedFlax } from './economy.js';
import { xpForLevel } from './skills.js';

function reach(state, skill, level) {
  const need = xpForLevel(level);
  const have = state.skills.getXp(skill);
  if (have < need) state.skills.addXp(skill, need - have);
}

describe('gather and craft messages use the actual amount', () => {
  it('flax at Farming 15 gives 2 and logs "Picked 2 Flax."', () => {
    const state = createState();
    reach(state, 'farming', 15);
    state.materials.flax = 0;
    const got = grantPickedFlax(state);
    assert.equal(got, 2);
    assert.equal(state.materials.flax, 2);
    assert.equal(`Picked ${got} Flax.`, 'Picked 2 Flax.');
  });

  it('essence at Mining 50 gives 3, matching inventory', () => {
    const state = createState();
    reach(state, 'mining', 50);
    state.materials.essence = 0;
    const got = grantMinedMaterial(state, 'essence');
    assert.equal(got, 3);
    assert.equal(state.materials.essence, 3);
  });

  it('doubled runes log "Crafted 2 Air runes."', () => {
    const state = createState();
    const recipe = RECIPES.air_rune;
    reach(state, 'runecrafting', 99);
    assert.equal(craftedOutputCount(state, recipe), 2);
    state.crafts.air_rune = { startedAt: 0, duration: 1, left: 1, total: 1 };
    const done = completeCrafts(state, 5);
    assert.deepEqual(done, ['air_rune']);
    assert.equal(done.amounts[0], 2);
    assert.equal(craftDoneMessage(state, 'air_rune', done.amounts[0]), 'Crafted 2 Air runes.');
    assert.equal(craftDoneMessage(state, 'air_rune', 1), 'Crafted 1 Air rune.');
  });

  it('single ware keeps the old wording', () => {
    const state = createState();
    assert.equal(craftDoneMessage(state, 'bread', 1), `Finished ${RECIPES.bread.name}. Into the chest.`);
  });
});
