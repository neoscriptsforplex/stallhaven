import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOMERS,
  MATERIALS,
  RECIPES,
  SHOP,
  START_GOLD,
  decideRequest,
  matchingArmourIds,
  recipeCost,
  recipeList,
} from './catalog.js';
import {
  buyFromCustomer,
  canCraft,
  chestCount,
  chestTotal,
  collectSale,
  completeCrafts,
  createState,
  decideAfterWait,
  decidePurchase,
  hasStock,
  placeFromChest,
  removeWare,
  restock,
  sellFromDisplay,
  sellToCustomer,
  startCraft,
} from './economy.js';
import { QUEUE_AISLE, queueSlot, rectHitsAisle } from './nav.js';

describe('stall economy', () => {
  it('starts with gold and a little of each material', () => {
    const state = createState();
    assert.equal(state.gold, START_GOLD);
    assert.equal(state.materials.grain, 5);
    assert.equal(state.materials.embercap, 3);
    assert.equal(state.materials.dulliron, 3);
    assert.equal(state.materials.bowheart, 3);
  });

  it('crafts from materials into the chest and showcases an empty stall', () => {
    const state = createState();
    assert.equal(canCraft(state, 'trailbread'), true);
    assert.equal(startCraft(state, 'trailbread', 0), true);
    assert.equal(state.materials.grain, 4);
    assert.deepEqual(completeCrafts(state, 7.9), []);
    assert.deepEqual(completeCrafts(state, 8), ['trailbread']);
    assert.equal(state.chest.trailbread, 1);
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
    assert.equal(chestCount(state, 'trailbread'), 0);
    assert.equal(restock(state, 'grain'), true);
    assert.equal(state.gold, START_GOLD + 12 - 4);
    assert.equal(state.materials.grain, 5);
  });

  it('keeps extra finished wares in the chest after a sale', () => {
    const state = createState();
    startCraft(state, 'trailbread', 0);
    startCraft(state, 'emberflask', 0);
    startCraft(state, 'thornpike', 0);
    completeCrafts(state, 20);
    assert.ok(state.displays[0].ware);
    assert.ok(state.displays[1].ware);
    assert.equal(chestTotal(state), 3);
    sellFromDisplay(state, 0);
    assert.equal(chestTotal(state), 2);
    assert.equal(hasStock(state, 'emberflask'), true);
    assert.equal(hasStock(state, 'thornpike'), true);
  });

  it('crafts a sword that spends gold and more than one material', () => {
    const state = createState();
    const goldBefore = state.gold;
    assert.equal(canCraft(state, 'steelcleaver'), true);
    assert.equal(startCraft(state, 'steelcleaver', 0), true);
    assert.equal(state.gold, goldBefore - RECIPES.steelcleaver.cost.gold);
    assert.equal(state.materials.brightsteel, 1);
    assert.equal(state.materials.dulliron, 2);
    completeCrafts(state, 12);
    assert.equal(state.chest.steelcleaver, 1);
    assert.equal(hasStock(state, 'steelcleaver'), true);
  });

  it('places a chest ware on the selected stall', () => {
    const state = createState();
    startCraft(state, 'ironedge', 0);
    completeCrafts(state, 8);
    state.selectedDisplay = 1;
    assert.equal(placeFromChest(state, 'ironedge', 1), true);
    assert.equal(state.displays[1].ware.recipeId, 'ironedge');
    assert.equal(state.chest.ironedge, 1);
  });

  it('puts a matching armour set on a stand', () => {
    const state = createState();
    state.materials.platescrap += 2;
    startCraft(state, 'ironhelm', 0);
    startCraft(state, 'ironmail', 0);
    startCraft(state, 'ironlegs', 0);
    completeCrafts(state, 20);
    const standIndex = SHOP.displays.findIndex((d) => d.kind === 'stand');
    assert.ok(standIndex >= 0);
    assert.equal(placeFromChest(state, 'ironhelm', standIndex), true);
    assert.equal(state.displays[standIndex].slots.helm, 'ironhelm');
    assert.equal(state.displays[standIndex].slots.body, 'ironmail');
    assert.equal(state.displays[standIndex].slots.legs, 'ironlegs');
  });
});

describe('customer trade', () => {
  it('sells a requested item from the chest and adds gold', () => {
    const state = createState();
    startCraft(state, 'ironedge', 0);
    completeCrafts(state, 8);
    const paid = sellToCustomer(state, 'ironedge', RECIPES.ironedge.price);
    assert.equal(paid, 20);
    assert.equal(state.gold, START_GOLD - 3 + 20);
    assert.equal(hasStock(state, 'ironedge'), false);
  });

  it('refuses a sale when the chest has no matching ware', () => {
    const state = createState();
    assert.equal(sellToCustomer(state, 'ironedge', 20), 0);
    assert.equal(state.gold, START_GOLD);
  });

  it('buys junk material from a traveler', () => {
    const state = createState();
    const before = state.materials.dulliron;
    assert.equal(buyFromCustomer(state, 'dulliron', 5), true);
    assert.equal(state.gold, START_GOLD - 5);
    assert.equal(state.materials.dulliron, before + 1);
  });

  it('asks mercenaries for melee gear and rangers for bows', () => {
    const melee = decideRequest('mercenary', () => 0);
    assert.equal(RECIPES[melee.recipeId].combatClass, 'melee');
    assert.ok(CUSTOMERS.mercenary.prefers.includes(melee.recipeId));
    const range = decideRequest('ranger', () => 0);
    assert.equal(RECIPES[range.recipeId].combatClass, 'range');
    const mage = decideRequest('hedgemage', () => 0);
    assert.ok(['magic', null].includes(RECIPES[mage.recipeId].combatClass));
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

describe('catalog', () => {
  it('gives every recipe real materials, a timer, and a buyer', () => {
    for (const recipe of recipeList()) {
      const cost = recipeCost(recipe);
      for (const id of Object.keys(cost.materials)) {
        assert.ok(MATERIALS[id], `missing material ${id} on ${recipe.id}`);
      }
      assert.ok(recipe.time > 0, recipe.id);
      assert.ok(recipe.price > 0, recipe.id);
      assert.ok(recipe.buyers.length, recipe.id);
    }
  });

  it('covers melee, range, and magic arms plus armour', () => {
    const swords = recipeList().filter((r) => r.slot === 'sword');
    const bows = recipeList().filter((r) => r.slot === 'bow');
    const staves = recipeList().filter((r) => r.slot === 'staff');
    assert.ok(swords.length >= 3);
    assert.ok(bows.length >= 3);
    assert.ok(staves.length >= 3);
    for (const cls of ['melee', 'range', 'magic']) {
      const helms = recipeList().filter((r) => r.combatClass === cls && r.slot === 'helm');
      const bodies = recipeList().filter((r) => r.combatClass === cls && r.slot === 'body');
      const legs = recipeList().filter((r) => r.combatClass === cls && r.slot === 'legs');
      assert.ok(helms.length >= 2, cls);
      assert.ok(bodies.length >= 2, cls);
      assert.ok(legs.length >= 2, cls);
    }
  });

  it('keeps at least four display spots plus shelves and armour stands', () => {
    assert.ok(SHOP.displays.length >= 4);
    assert.ok(SHOP.displays.filter((d) => d.kind === 'table').length >= 4);
    assert.ok(SHOP.displays.some((d) => d.kind === 'shelf'));
    assert.ok(SHOP.displays.some((d) => d.kind === 'stand'));
  });

  it('keeps a clear queue aisle in front of the counter', () => {
    for (const spot of SHOP.displays) {
      if (spot.kind === 'shelf') continue;
      const hw = spot.kind === 'stand' ? 0.36 : 0.76;
      const hd = spot.kind === 'stand' ? 0.36 : 0.52;
      assert.equal(rectHitsAisle(spot.x, spot.z, hw, hd, QUEUE_AISLE), false, spot.name);
    }
    assert.equal(rectHitsAisle(SHOP.anvil.x, SHOP.anvil.z, 0.48, 0.4, QUEUE_AISLE), false);
    assert.equal(rectHitsAisle(SHOP.chest.x, SHOP.chest.z, 0.54, 0.41, QUEUE_AISLE), false);
  });

  it('lines travelers up in front of the counter', () => {
    const front = queueSlot(0);
    const second = queueSlot(1);
    assert.ok(front.z > SHOP.counter.z);
    assert.ok(second.z > front.z);
    assert.equal(front.x, SHOP.queue.x);
  });

  it('groups matching helm, body, and legs for a stand', () => {
    const slots = matchingArmourIds('ironhelm', ['ironhelm', 'ironmail', 'ironlegs', 'steelhelm']);
    assert.equal(slots.helm, 'ironhelm');
    assert.equal(slots.body, 'ironmail');
    assert.equal(slots.legs, 'ironlegs');
  });
});
