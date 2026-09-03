import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOMERS, RECIPES, START_GOLD } from './catalog.js';
import {
  canCraft,
  collectSale,
  completeCrafts,
  createState,
  decideAfterWait,
  decidePurchase,
  removeWare,
  restock,
  sellFromDisplay,
  startCraft,
} from './economy.js';

describe('stall economy', () => {
  it('starts with gold and a little of each material', () => {
    const state = createState();
    assert.equal(state.gold, START_GOLD);
    assert.equal(state.materials.grain, 5);
    assert.equal(state.materials.embercap, 3);
  });

  it('crafts from one material and stocks a display when the timer ends', () => {
    const state = createState();
    assert.equal(canCraft(state, 'trailbread'), true);
    assert.equal(startCraft(state, 'trailbread', 0), true);
    assert.equal(state.materials.grain, 4);
    assert.deepEqual(completeCrafts(state, 7.9), []);
    assert.deepEqual(completeCrafts(state, 8), ['trailbread']);
    assert.equal(state.displays[0].ware.recipeId, 'trailbread');
  });

  it('sells at the recipe gold price and restocks materials for gold', () => {
    const state = createState();
    startCraft(state, 'trailbread', 0);
    completeCrafts(state, 8);
    const recipeId = removeWare(state, 0);
    assert.equal(recipeId, 'trailbread');
    const price = collectSale(state, recipeId);
    assert.equal(price, RECIPES.trailbread.price);
    assert.equal(state.gold, START_GOLD + 12);
    assert.equal(state.displays[0].ware, null);
    assert.equal(restock(state, 'grain'), true);
    assert.equal(state.gold, START_GOLD + 12 - 4);
    assert.equal(state.materials.grain, 5);
  });

  it('auto-shelves extra finished wares after a sale', () => {
    const state = createState();
    startCraft(state, 'trailbread', 0);
    startCraft(state, 'emberflask', 0);
    startCraft(state, 'thornpike', 0);
    completeCrafts(state, 20);
    assert.ok(state.displays[0].ware);
    assert.ok(state.displays[1].ware);
    assert.equal(state.ready.length, 1);
    sellFromDisplay(state, 0);
    assert.ok(state.displays[0].ware);
    assert.equal(state.ready.length, 0);
  });
});

describe('adventurer choices', () => {
  it('picks a preferred ware on a display', () => {
    const wares = [{ index: 1, recipeId: 'thornpike' }];
    const choice = decidePurchase('mercenary', wares, () => 0);
    assert.equal(choice.action, 'buy');
    assert.equal(choice.recipeId, 'thornpike');
  });

  it('sends a mercenary away from an empty stall', () => {
    const choice = decidePurchase('mercenary', [], () => 0);
    assert.equal(choice.action, 'leave');
    assert.equal(CUSTOMERS.mercenary.leaveIfEmpty, true);
  });

  it('lets a pilgrim wait when nothing preferred is out', () => {
    const empty = decidePurchase('pilgrim', [], () => 0);
    assert.equal(empty.action, 'wait');
    const other = decidePurchase('pilgrim', [{ index: 0, recipeId: 'emberflask' }], () => 0);
    assert.equal(other.action, 'wait');
    const later = decideAfterWait('pilgrim', [{ index: 0, recipeId: 'trailbread' }], () => 0);
    assert.equal(later.action, 'buy');
  });
});
