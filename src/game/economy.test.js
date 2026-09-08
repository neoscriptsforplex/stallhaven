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
  recipesForTab,
  unlockNeed,
  CRAFT_TABS,
} from './catalog.js';
import {
  applyState,
  buyFromCustomer,
  canCraft,
  chestCount,
  chestTotal,
  completeCrafts,
  createState,
  decideAfterWait,
  decidePurchase,
  hasStock,
  isUnlocked,
  placeFromChest,
  restock,
  sellToCustomer,
  serializeState,
  startCraft,
  unlockRemaining,
} from './economy.js';
import { QUEUE_AISLE, queueSlot, rectHitsAisle } from './nav.js';

function finishCraft(state, recipeId, at = 0) {
  assert.equal(startCraft(state, recipeId, at), true, `could not start ${recipeId}`);
  const done = completeCrafts(state, at + RECIPES[recipeId].time);
  assert.ok(done.includes(recipeId), `did not finish ${recipeId}`);
}

describe('stall economy', () => {
  it('starts with gold and a little of each starter material', () => {
    const state = createState();
    assert.equal(state.gold, START_GOLD);
    assert.equal(state.materials.bronze, 12);
    assert.equal(state.materials.flour, 10);
    assert.equal(state.materials.logs, 8);
    assert.equal(state.materials.hide, 8);
  });

  it('crafts from materials into the chest and showcases an empty stall', () => {
    const state = createState();
    assert.equal(canCraft(state, 'bread'), true);
    assert.equal(startCraft(state, 'bread', 0), true);
    assert.equal(state.materials.flour, 9);
    assert.deepEqual(completeCrafts(state, 2.9), []);
    assert.deepEqual(completeCrafts(state, 3), ['bread']);
    assert.equal(state.chest.bread, 1);
    assert.equal(state.craftCounts.bread, 1);
    assert.ok(state.displays.some((d) => d.ware?.recipeId === 'bread'));
  });

  it('sells at the recipe gold price and restocks materials for gold', () => {
    const state = createState();
    finishCraft(state, 'bread');
    const paid = sellToCustomer(state, 'bread', RECIPES.bread.price);
    assert.equal(paid, RECIPES.bread.price);
    assert.equal(state.gold, START_GOLD + RECIPES.bread.price);
    assert.equal(chestCount(state, 'bread'), 0);
    assert.equal(restock(state, 'flour'), true);
    assert.equal(state.gold, START_GOLD + RECIPES.bread.price - MATERIALS.flour.restock);
  });

  it('keeps extra finished wares in the chest after a sale', () => {
    const state = createState();
    finishCraft(state, 'bread');
    finishCraft(state, 'bronze_sword');
    finishCraft(state, 'staff');
    assert.equal(chestTotal(state), 3);
    sellToCustomer(state, 'bread', RECIPES.bread.price);
    assert.equal(chestTotal(state), 2);
    assert.equal(hasStock(state, 'bronze_sword'), true);
    assert.equal(hasStock(state, 'staff'), true);
  });

  it('places a chest ware on the selected stall', () => {
    const state = createState();
    finishCraft(state, 'bronze_sword');
    state.selectedDisplay = 1;
    assert.equal(placeFromChest(state, 'bronze_sword', 1), true);
    assert.equal(state.displays[1].ware.recipeId, 'bronze_sword');
    assert.equal(state.chest.bronze_sword, 1);
  });

  it('puts a matching armour set on a stand', () => {
    const state = createState();
    state.materials.bronze += 8;
    finishCraft(state, 'bronze_full_helm');
    finishCraft(state, 'bronze_platebody');
    finishCraft(state, 'bronze_platelegs');
    const standIndex = SHOP.displays.findIndex((d) => d.kind === 'stand');
    assert.ok(standIndex >= 0);
    assert.equal(placeFromChest(state, 'bronze_full_helm', standIndex), true);
    assert.equal(state.displays[standIndex].slots.helm, 'bronze_full_helm');
    assert.equal(state.displays[standIndex].slots.body, 'bronze_platebody');
    assert.equal(state.displays[standIndex].slots.legs, 'bronze_platelegs');
  });

  it('prefers food on wall shelves', () => {
    const state = createState();
    finishCraft(state, 'bread');
    const shelfIndex = SHOP.displays.findIndex((d) => d.kind === 'shelf');
    assert.ok(shelfIndex >= 0);
    assert.equal(state.displays[shelfIndex].ware?.recipeId, 'bread');
  });
});

describe('unlock lines', () => {
  it('uses 20, then 30, then +10 each step', () => {
    assert.equal(unlockNeed(0), 0);
    assert.equal(unlockNeed(1), 20);
    assert.equal(unlockNeed(2), 30);
    assert.equal(unlockNeed(3), 40);
    assert.equal(unlockNeed(6), 70);
  });

  it('keeps bronze, staff, blue d hide, and bread unlocked on a new shop', () => {
    const state = createState();
    assert.equal(isUnlocked(state, 'bronze_sword'), true);
    assert.equal(isUnlocked(state, 'staff'), true);
    assert.equal(isUnlocked(state, 'blue_dhide_body'), true);
    assert.equal(isUnlocked(state, 'bread'), true);
    assert.equal(isUnlocked(state, 'iron_sword'), false);
    assert.equal(isUnlocked(state, 'mystic_staff'), false);
    assert.equal(isUnlocked(state, 'green_dhide_body'), false);
    assert.equal(isUnlocked(state, 'pizza'), false);
    assert.equal(unlockRemaining(state, 'iron_sword'), 20);
  });

  it('unlocks iron after 20 bronze crafts of the same line', () => {
    const state = createState();
    state.materials.bronze = 30;
    for (let i = 0; i < 19; i += 1) finishCraft(state, 'bronze_sword', i * 10);
    assert.equal(isUnlocked(state, 'iron_sword'), false);
    finishCraft(state, 'bronze_sword', 200);
    assert.equal(state.craftCounts.bronze_sword, 20);
    assert.equal(isUnlocked(state, 'iron_sword'), true);
    assert.equal(canCraft(state, 'iron_sword'), true);
  });

  it('needs 30 iron crafts to unlock steel in that line', () => {
    const state = createState();
    state.craftCounts.bronze_sword = 20;
    state.craftCounts.iron_sword = 29;
    state.materials.iron = 5;
    assert.equal(isUnlocked(state, 'steel_sword'), false);
    finishCraft(state, 'iron_sword');
    assert.equal(isUnlocked(state, 'steel_sword'), true);
  });
});

describe('save and load', () => {
  it('round-trips gold, materials, chest, craft counts, and displays', () => {
    const state = createState();
    finishCraft(state, 'bronze_scimitar');
    state.gold = 77;
    state.selectedDisplay = 2;
    const saved = serializeState(state);
    const other = createState();
    assert.equal(applyState(other, saved), true);
    assert.equal(other.gold, 77);
    assert.equal(other.chest.bronze_scimitar, 1);
    assert.equal(other.craftCounts.bronze_scimitar, 1);
    assert.equal(other.displays[2].ware?.recipeId ?? other.displays.find((d) => d.ware?.recipeId === 'bronze_scimitar')?.ware.recipeId, 'bronze_scimitar');
  });
});

describe('customer trade', () => {
  it('sells a requested item from the chest and adds gold', () => {
    const state = createState();
    finishCraft(state, 'bronze_sword');
    const paid = sellToCustomer(state, 'bronze_sword', RECIPES.bronze_sword.price);
    assert.equal(paid, RECIPES.bronze_sword.price);
    assert.equal(hasStock(state, 'bronze_sword'), false);
  });

  it('refuses a sale when the chest has no matching ware', () => {
    const state = createState();
    assert.equal(sellToCustomer(state, 'bronze_sword', 20), 0);
    assert.equal(state.gold, START_GOLD);
  });

  it('buys junk material from a traveler', () => {
    const state = createState();
    const before = state.materials.bronze;
    assert.equal(buyFromCustomer(state, 'bronze', 4), true);
    assert.equal(state.gold, START_GOLD - 4);
    assert.equal(state.materials.bronze, before + 1);
  });

  it('asks mercenaries for melee gear and rangers for range gear', () => {
    const melee = decideRequest('mercenary', () => 0);
    assert.equal(RECIPES[melee.recipeId].combatClass, 'melee');
    assert.ok(CUSTOMERS.mercenary.prefers.includes(melee.recipeId));
    const range = decideRequest('ranger', () => 0);
    assert.equal(RECIPES[range.recipeId].combatClass, 'range');
    const mage = decideRequest('hedgemage', () => 0);
    assert.equal(RECIPES[mage.recipeId].combatClass, 'magic');
  });
});

describe('adventurer choices', () => {
  it('picks a preferred ware on a display', () => {
    const wares = [{ index: 1, recipeId: 'bronze_spear' }];
    const choice = decidePurchase('mercenary', wares, () => 0);
    assert.equal(choice.action, 'buy');
    assert.equal(choice.recipeId, 'bronze_spear');
  });

  it('sends a mercenary away from an empty stall', () => {
    const choice = decidePurchase('mercenary', [], () => 0);
    assert.equal(choice.action, 'leave');
    assert.equal(CUSTOMERS.mercenary.leaveIfEmpty, true);
  });

  it('lets a pilgrim wait when nothing preferred is out', () => {
    const empty = decidePurchase('pilgrim', [], () => 0);
    assert.equal(empty.action, 'wait');
    const other = decidePurchase('pilgrim', [{ index: 0, recipeId: 'staff' }], () => 0);
    assert.equal(other.action, 'wait');
    const later = decideAfterWait('pilgrim', [{ index: 0, recipeId: 'bread' }], () => 0);
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

  it('covers the full melee, magic, range, and food catalog', () => {
    const recipes = recipeList();
    assert.equal(recipes.filter((r) => r.combatClass === 'melee' && r.category === 'weapon').length, 49);
    assert.equal(recipes.filter((r) => r.combatClass === 'melee' && r.category === 'armour').length, 56);
    assert.equal(recipes.filter((r) => r.shape?.startsWith('staff')).length, 5);
    assert.equal(recipes.filter((r) => r.combatClass === 'magic' && r.category === 'armour').length, 25);
    assert.equal(recipes.filter((r) => r.combatClass === 'range' && r.category === 'weapon').length, 35);
    assert.equal(recipes.filter((r) => r.name.includes("d'hide")).length, 16);
    assert.equal(recipes.filter((r) => r.category === 'food').length, 5);
    assert.equal(RECIPES.bronze_scimitar.name, 'Bronze Scimitar');
    assert.equal(RECIPES.iron_platebody.name, 'Iron Platebody');
    assert.equal(RECIPES.magic_hat.name, 'Magic hat');
    assert.equal(RECIPES.mystic_robe_top.name, 'Mystic robe top');
    assert.equal(RECIPES.blue_dhide_body.name, "Blue d'hide body");
    assert.equal(RECIPES.green_dhide_chaps.name, "Green d'hide chaps");
    assert.equal(RECIPES.staff.name, 'Staff');
    assert.equal(RECIPES.mystic_staff.name, 'Mystic Staff');
    assert.equal(RECIPES.battle_staff.name, 'Battle Staff');
    assert.equal(RECIPES.lunar_staff.name, 'Lunar Staff');
    assert.equal(RECIPES.ancient_staff.name, 'Ancient Staff');
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

  it('lines tables up in two columns and keeps armour stands out of the corners', () => {
    const tables = SHOP.displays.filter((d) => d.kind === 'table');
    const leftX = tables.filter((d) => d.x < 0).map((d) => d.x);
    const rightX = tables.filter((d) => d.x > 0).map((d) => d.x);
    assert.ok(leftX.length >= 2);
    assert.ok(rightX.length >= 2);
    assert.ok(leftX.every((x) => x === leftX[0]));
    assert.ok(rightX.every((x) => x === rightX[0]));
    for (const stand of SHOP.displays.filter((d) => d.kind === 'stand')) {
      assert.ok(Math.abs(stand.x) < 2.2, stand.name);
      assert.ok(stand.z > 2, stand.name);
    }
    assert.equal(SHOP.clutter?.length ?? 0, 0);
  });

  it('groups anvil recipes by melee, magic, ranged, food, and an empty potions tab', () => {
    assert.deepEqual(CRAFT_TABS.map((tab) => tab.label), ['Melee', 'Magic', 'Ranged', 'Food', 'Potions']);
    const melee = recipesForTab('melee');
    const magic = recipesForTab('magic');
    const ranged = recipesForTab('ranged');
    const food = recipesForTab('food');
    assert.ok(melee.length > 0);
    assert.ok(melee.every((r) => r.combatClass === 'melee'));
    assert.ok(magic.every((r) => r.combatClass === 'magic'));
    assert.ok(ranged.every((r) => r.combatClass === 'range'));
    assert.ok(food.every((r) => r.category === 'food'));
    assert.equal(recipesForTab('potion').length, 0);
    assert.ok(melee.some((r) => r.id === 'bronze_sword'));
    assert.ok(!melee.some((r) => r.id === 'staff'));
    assert.ok(magic.some((r) => r.id === 'staff'));
    assert.ok(ranged.some((r) => r.id === 'bronze_shortbow'));
    assert.ok(food.some((r) => r.id === 'bread'));
  });

  it('groups matching helm, body, and legs for a stand', () => {
    const slots = matchingArmourIds('bronze_full_helm', [
      'bronze_full_helm',
      'bronze_platebody',
      'bronze_platelegs',
      'iron_full_helm',
    ]);
    assert.equal(slots.helm, 'bronze_full_helm');
    assert.equal(slots.body, 'bronze_platebody');
    assert.equal(slots.legs, 'bronze_platelegs');
  });
});
