import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FISH_YIELDS } from './catalog.js';
import { createState, grantCaughtFish, grantMinedMaterial, grantPickedFlax, grantPickedWheat, pickYield } from './economy.js';
import { essencePerBar, pickYieldFor, xpForLevel } from './skills.js';
import { constructionPiece } from './construction.js';
import { retireHero, emptyHeroQuestState } from './heroesQuests.js';

function reach(state, skill, level) {
  const need = xpForLevel(level);
  const have = state.skills.getXp(skill);
  if (have < need) state.skills.addXp(skill, need - have);
}

describe('gathering rates', () => {
  it('fishing gives 1 fish per filled bar', () => {
    for (const n of Object.values(FISH_YIELDS)) assert.equal(n, 1);
    const state = createState();
    state.materials.raw_shrimp = 0;
    assert.equal(grantCaughtFish(state, 'raw_shrimp'), 1);
  });

  it('essence per bar: 1, 2 at 25, 3 at 50, 4 at 75, 5 at 99', () => {
    assert.deepEqual([1, 24, 25, 49, 50, 74, 75, 98, 99].map(essencePerBar), [1, 1, 2, 2, 3, 3, 4, 4, 5]);
    const state = createState();
    for (const [lv, want] of [[1, 1], [25, 2], [50, 3], [75, 4], [99, 5]]) {
      reach(state, 'mining', lv);
      state.materials.essence = 0;
      assert.equal(grantMinedMaterial(state, 'essence'), want, `Mining ${lv}`);
    }
  });

  it('flax doubles at Farming 15 and wheat at Farming 40', () => {
    assert.equal(pickYieldFor('flax', 14), 1);
    assert.equal(pickYieldFor('flax', 15), 2);
    assert.equal(pickYieldFor('wheat', 39), 1);
    assert.equal(pickYieldFor('wheat', 40), 2);
    const state = createState();
    state.materials.flax = 0;
    state.materials.wheat = 0;
    assert.equal(grantPickedFlax(state), 1);
    assert.equal(grantPickedWheat(state), 1);
    reach(state, 'farming', 15);
    assert.equal(pickYield(state, 'flax'), 2);
    assert.equal(pickYield(state, 'wheat'), 1);
    reach(state, 'farming', 40);
    assert.equal(grantPickedWheat(state), 2);
    assert.equal(grantPickedFlax(state), 2);
  });
});

describe('construction unlock levels', () => {
  it('matches the approved levels and mounts', () => {
    const want = { chair: 5, fire: 5, old_bookshelf: 10, bench: 20, double_bed: 50, standing_candles: 60, fancy_chair: 60, fancy_table: 65, throne: 99 };
    for (const [id, lv] of Object.entries(want)) assert.equal(constructionPiece(id).level, lv, id);
    for (const id of ['barrel_of_sticks', 'barrel_of_fish', 'sacks']) assert.equal(constructionPiece(id).mount, 'outdoor', id);
    const basic = constructionPiece('basic_table');
    assert.equal(basic.category, 'Tables');
    assert.equal(basic.level, 1);
    assert.equal(basic.mount, 'outdoor');
  });
});

describe('retire hero', () => {
  it('removes the hero and their running quest', () => {
    const hq = emptyHeroQuestState();
    hq.heroes.adventurer = { npcId: 'x', name: 'A', hiredAt: 0 };
    hq.quests.active.q = { heroId: 'adventurer', startedAt: 0, endsAt: 1 };
    assert.equal(retireHero(hq, 'adventurer'), true);
    assert.equal(hq.heroes.adventurer, null);
    assert.deepEqual(hq.quests.active, {});
    assert.equal(retireHero(hq, 'adventurer'), false);
  });
});
