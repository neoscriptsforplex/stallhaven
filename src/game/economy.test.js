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
  ANVIL_SUBTABS,
  nearestShelfSlot,
  SHELF_SLOT_COUNT,
  offerClassOf,
} from './catalog.js';
import {
  applyState,
  buyCauldron,
  buyExpansion,
  buyFromCustomer,
  buyFurniture,
  canBuyCauldron,
  canBuyFurniture,
  canCraft,
  CAULDRON_COST,
  chestCapacity,
  chestCount,
  chestTotal,
  completeCrafts,
  craftBlockReason,
  createState,
  decideAfterWait,
  decidePurchase,
  hasStock,
  isUnlocked,
  offerChoices,
  ownsCauldron,
  placeFromChest,
  placeOnDisplay,
  restock,
  sellToCustomer,
  serializeState,
  startCraft,
  swapOffer,
  tickMaterials,
  unlockRemaining,
  upgradeChest,
} from './economy.js';
import { QUEUE_AISLE, queueSlot, rectHitsAisle } from './nav.js';

function finishCraft(state, recipeId, at = 0) {
  assert.equal(startCraft(state, recipeId, at), true, `could not start ${recipeId}`);
  const done = completeCrafts(state, at + RECIPES[recipeId].time);
  assert.ok(done.includes(recipeId), `did not finish ${recipeId}`);
}

function sequentialRng(...values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('stall economy', () => {
  it('starts with gold and a little of each starter material', () => {
    const state = createState();
    assert.equal(state.gold, START_GOLD);
    assert.equal(state.materials.bronze, 12);
    assert.equal(state.materials.flour, 10);
    assert.equal(state.materials.logs, 8);
    assert.equal(state.materials.hide, 8);
    assert.equal(state.materials.herbs, 8);
    assert.equal(state.materials.water, 12);
  });

  it('crafts from materials into the chest without auto-placing on stalls', () => {
    const state = createState();
    assert.equal(canCraft(state, 'bread'), true);
    assert.equal(startCraft(state, 'bread', 0), true);
    assert.equal(state.materials.flour, 9);
    assert.deepEqual(completeCrafts(state, 2.9), []);
    assert.deepEqual(completeCrafts(state, 3), ['bread']);
    assert.equal(state.chest.bread, 1);
    assert.equal(state.craftCounts.bread, 1);
    assert.equal(state.displays.every((d) => !d.ware), true);
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

  it('places a chest ware on the selected stall and takes it from the chest', () => {
    const state = createState();
    finishCraft(state, 'bronze_sword');
    state.selectedDisplay = 1;
    assert.equal(placeFromChest(state, 'bronze_sword', 1), true);
    assert.equal(state.displays[1].ware.recipeId, 'bronze_sword');
    assert.equal(state.chest.bronze_sword, undefined);
    assert.equal(hasStock(state, 'bronze_sword'), true);
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

  it('places food onto a chosen shelf slot and swaps the previous ware back to the chest', () => {
    const state = createState();
    finishCraft(state, 'bread');
    finishCraft(state, 'bronze_sword');
    const shelfIndex = SHOP.displays.findIndex((d) => d.kind === 'shelf');
    assert.ok(shelfIndex >= 0);
    assert.equal(placeOnDisplay(state, 'bread', shelfIndex, 0), true);
    assert.equal(state.displays[shelfIndex].shelfSlots[0], 'bread');
    assert.equal(state.chest.bread, undefined);
    assert.equal(placeOnDisplay(state, 'bronze_sword', shelfIndex, 0), true);
    assert.equal(state.displays[shelfIndex].shelfSlots[0], 'bronze_sword');
    assert.equal(state.chest.bread, 1);
    assert.equal(state.chest.bronze_sword, undefined);
    assert.equal(placeOnDisplay(state, 'bread', shelfIndex, 3), true);
    assert.equal(state.displays[shelfIndex].shelfSlots[0], 'bronze_sword');
    assert.equal(state.displays[shelfIndex].shelfSlots[3], 'bread');
    assert.equal(SHELF_SLOT_COUNT, 4);
    assert.equal(nearestShelfSlot(-0.4, 0.02), 0);
    assert.equal(nearestShelfSlot(0.4, 0.02), 1);
    assert.equal(nearestShelfSlot(-0.4, -0.44), 2);
    assert.equal(nearestShelfSlot(0.4, -0.44), 3);
  });

  it('places a chest ware on a table and returns the previous ware to the chest', () => {
    const state = createState();
    finishCraft(state, 'bronze_sword');
    finishCraft(state, 'staff');
    const tableIndex = SHOP.displays.findIndex((d) => d.kind === 'table');
    assert.ok(tableIndex >= 0);
    assert.equal(placeOnDisplay(state, 'bronze_sword', tableIndex), true);
    assert.equal(state.displays[tableIndex].ware.recipeId, 'bronze_sword');
    assert.equal(state.chest.bronze_sword, undefined);
    assert.equal(placeOnDisplay(state, 'staff', tableIndex), true);
    assert.equal(state.displays[tableIndex].ware.recipeId, 'staff');
    assert.equal(state.chest.bronze_sword, 1);
    assert.equal(state.chest.staff, undefined);
    assert.equal(placeOnDisplay(state, 'bread', tableIndex), false);
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
  it('round-trips gold, materials, chest, craft counts, chest level, expansions, and furniture', () => {
    const state = createState();
    finishCraft(state, 'bronze_scimitar');
    state.gold = 77;
    state.selectedDisplay = 2;
    state.chestLevel = 3;
    state.expansions = ['left'];
    state.furniture.anvil.x = -2.4;
    state.materialAcc.bronze = 0.4;
    const saved = serializeState(state);
    const other = createState();
    assert.equal(applyState(other, saved), true);
    assert.equal(other.gold, 77);
    assert.equal(other.chest.bronze_scimitar, 1);
    assert.equal(other.craftCounts.bronze_scimitar, 1);
    assert.equal(other.chestLevel, 3);
    assert.deepEqual(other.expansions, ['left']);
    assert.equal(other.furniture.anvil.x, -2.4);
    assert.equal(other.materialAcc.bronze, 0.4);
    assert.equal(other.chest.bronze_scimitar, 1);
    assert.equal(other.music.volume, state.music.volume);
  });

  it('loads older save JSON that is missing new fields', () => {
    const state = createState();
    assert.equal(applyState(state, {
      gold: 12,
      materials: { bronze: 4, flour: 2 },
      chest: { bread: 2 },
    }), true);
    assert.equal(state.gold, 12);
    assert.equal(state.materials.bronze, 4);
    assert.equal(state.materials.herbs, 8);
    assert.equal(state.materials.water, 12);
    assert.equal(state.chest.bread, 2);
    assert.equal(state.fullscreen, false);
    assert.ok(state.music.volume > 0);
    const shelfIndex = SHOP.displays.findIndex((d) => d.kind === 'shelf');
    assert.equal(state.displays[shelfIndex].shelfSlots.length, 4);
    assert.equal(state.displays[shelfIndex].shelfSlots.every((id) => id == null), true);
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

  it('usually asks for an unlocked recipe the player can already craft', () => {
    const state = createState();
    const rng = sequentialRng(0.9, 0);
    const melee = decideRequest('mercenary', rng, state);
    assert.equal(isUnlocked(state, melee.recipeId), true);
    assert.equal(RECIPES[melee.recipeId].combatClass, 'melee');
    const food = decideRequest('pilgrim', sequentialRng(0.9, 0), state);
    assert.equal(food.recipeId, 'bread');
  });

  it('sometimes asks for a higher-tier item that is still locked', () => {
    const state = createState();
    const melee = decideRequest('mercenary', sequentialRng(0, 0), state);
    assert.equal(isUnlocked(state, melee.recipeId), false);
    assert.ok((RECIPES[melee.recipeId].tier ?? 1) > 1);
    assert.ok(RECIPES[melee.recipeId].price > RECIPES.bronze_scimitar.price);
  });

  it('lists chest items as offer choices at a reduced sale price', () => {
    const state = createState();
    finishCraft(state, 'bread');
    finishCraft(state, 'bronze_sword');
    const choices = offerChoices(state, 'bronze_scimitar');
    assert.equal(choices.length, 1);
    const sword = choices.find((choice) => choice.recipeId === 'bronze_sword');
    const bread = choices.find((choice) => choice.recipeId === 'bread');
    assert.ok(sword);
    assert.equal(bread, undefined);
    assert.ok(sword.gold < RECIPES.bronze_sword.price);
    assert.equal(sword.gold, Math.round(RECIPES.bronze_sword.price * 0.65));
    assert.equal(sword.listPrice, RECIPES.bronze_sword.price);
    assert.equal(offerChoices(state, 'bronze_sword').some((choice) => choice.recipeId === 'bronze_sword'), false);
  });

  it('only lists same-class chest items in the offer picker', () => {
    const state = createState();
    finishCraft(state, 'bread');
    finishCraft(state, 'bronze_sword');
    finishCraft(state, 'staff');
    finishCraft(state, 'bronze_shortbow');
    const melee = offerChoices(state, 'bronze_scimitar').map((choice) => choice.recipeId);
    assert.deepEqual(melee, ['bronze_sword']);
    const food = offerChoices(state, 'pizza').map((choice) => choice.recipeId);
    assert.deepEqual(food, ['bread']);
    const magic = offerChoices(state, 'mystic_staff').map((choice) => choice.recipeId);
    assert.deepEqual(magic, ['staff']);
    const ranged = offerChoices(state, 'bronze_longbow').map((choice) => choice.recipeId);
    assert.deepEqual(ranged, ['bronze_shortbow']);
    assert.equal(offerClassOf(RECIPES.staff), 'magic');
    assert.equal(offerChoices(state, 'bread').length, 0);
  });

  it('offers a swap of another stocked preferred item at a reduced price', () => {
    const state = createState();
    finishCraft(state, 'bread');
    finishCraft(state, 'bronze_sword');
    const swap = swapOffer(state, 'mercenary', 'bronze_scimitar');
    assert.ok(swap);
    assert.equal(swap.recipeId, 'bronze_sword');
    assert.ok(swap.gold < RECIPES.bronze_sword.price);
    assert.equal(swap.gold, Math.round(RECIPES.bronze_sword.price * 0.65));
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
    assert.equal(recipes.filter((r) => /d'hide/i.test(r.name)).length, 16);
    assert.equal(recipes.filter((r) => r.category === 'food').length, 5);
    assert.equal(recipes.filter((r) => r.category === 'potion').length, 8);
    assert.equal(RECIPES.bronze_scimitar.name, 'Bronze Scimitar');
    assert.equal(RECIPES.iron_platebody.name, 'Iron Platebody');
    assert.equal(RECIPES.magic_hat.name, 'Magic Hat');
    assert.equal(RECIPES.mystic_robe_top.name, 'Mystic Robe Top');
    assert.equal(RECIPES.blue_dhide_body.name, "Blue D'hide Body");
    assert.equal(RECIPES.green_dhide_chaps.name, "Green D'hide Chaps");
    assert.equal(RECIPES.staff.name, 'Staff');
    assert.equal(RECIPES.mystic_staff.name, 'Mystic Staff');
    assert.equal(RECIPES.battle_staff.name, 'Battle Staff');
    assert.equal(RECIPES.lunar_staff.name, 'Lunar Staff');
    assert.equal(RECIPES.ancient_staff.name, 'Ancient Staff');
    assert.equal(RECIPES.fish_pie.name, 'Fish Pie');
    assert.equal(RECIPES.bronze_2h_sword.name, 'Bronze 2H Sword');
    assert.equal(RECIPES.bronze_thrownaxe.name, 'Bronze Thrown Axe');
  });

  it('title-cases every recipe name', () => {
    for (const recipe of recipeList()) {
      for (const word of recipe.name.split(/\s+/)) {
        const letter = word.replace(/^[^A-Za-z]+/, '')[0];
        if (!letter) continue;
        assert.equal(letter, letter.toUpperCase(), recipe.name);
      }
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
    assert.equal(rectHitsAisle(SHOP.range.x, SHOP.range.z, 0.34, 0.28, QUEUE_AISLE), false);
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

  it('groups anvil recipes by melee, magic, and ranged with weapons and armour subtabs', () => {
    assert.deepEqual(CRAFT_TABS.map((tab) => tab.label), ['Melee', 'Magic', 'Ranged']);
    assert.deepEqual(ANVIL_SUBTABS.map((tab) => tab.label), ['Weapons', 'Armour']);
    const melee = recipesForTab('melee');
    const meleeWeapons = recipesForTab('melee', 'weapon');
    const meleeArmour = recipesForTab('melee', 'armour');
    const magic = recipesForTab('magic');
    const ranged = recipesForTab('ranged');
    const food = recipesForTab('food');
    const potions = recipesForTab('potion');
    assert.ok(melee.length > 0);
    assert.ok(melee.every((r) => r.combatClass === 'melee'));
    assert.ok(meleeWeapons.every((r) => r.category === 'weapon'));
    assert.ok(meleeArmour.every((r) => r.category === 'armour'));
    assert.equal(meleeWeapons.length + meleeArmour.length, melee.length);
    assert.ok(magic.every((r) => r.combatClass === 'magic'));
    assert.ok(ranged.every((r) => r.combatClass === 'range'));
    assert.ok(food.every((r) => r.category === 'food'));
    assert.equal(potions.length, 8);
    assert.ok(melee.some((r) => r.id === 'bronze_sword'));
    assert.ok(!melee.some((r) => r.id === 'staff'));
    assert.ok(magic.some((r) => r.id === 'staff'));
    assert.ok(ranged.some((r) => r.id === 'bronze_shortbow'));
    assert.ok(food.some((r) => r.id === 'bread'));
    assert.ok(!melee.some((r) => r.category === 'food'));
    assert.equal(RECIPES.strength_potion.name, 'Strength Potion');
    assert.equal(RECIPES.anti_poison_potion.name, 'Anti Poison Potion');
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

describe('chest upgrades', () => {
  it('starts at 100 slots and climbs 100 per level to 1000 at level 10', () => {
    const state = createState();
    assert.equal(state.chestLevel, 1);
    assert.equal(chestCapacity(state), 100);
    state.gold = 500;
    assert.equal(upgradeChest(state), true);
    assert.equal(state.chestLevel, 2);
    assert.equal(chestCapacity(state), 200);
    assert.equal(state.gold, 0);
    state.gold = 1500;
    assert.equal(upgradeChest(state), true);
    assert.equal(state.chestLevel, 3);
    assert.equal(chestCapacity(state), 300);
  });

  it('costs 500g then triples each upgrade', () => {
    const state = createState();
    state.gold = 499;
    assert.equal(upgradeChest(state), false);
    state.gold = 500;
    upgradeChest(state);
    state.gold = 1499;
    assert.equal(upgradeChest(state), false);
    state.gold = 1500;
    assert.equal(upgradeChest(state), true);
  });
});

describe('material regen', () => {
  it('fills basic materials faster than high-tier metals, capped at 250', () => {
    const state = createState();
    state.materials.bronze = 0;
    state.materials.dragon = 0;
    tickMaterials(state, 8);
    assert.equal(state.materials.bronze, 1);
    tickMaterials(state, 8);
    assert.ok(state.materials.dragon < state.materials.bronze);
    state.materials.bronze = 249;
    state.materialAcc.bronze = 0;
    tickMaterials(state, 16);
    assert.equal(state.materials.bronze, 250);
    tickMaterials(state, 80);
    assert.equal(state.materials.bronze, 250);
  });
});

describe('shop expansions', () => {
  it('sells the first extra room for 10000g and the next for three times that', () => {
    const state = createState();
    state.gold = 10000;
    assert.equal(buyExpansion(state, 'left'), true);
    assert.deepEqual(state.expansions, ['left']);
    assert.equal(state.gold, 0);
    state.gold = 30000;
    assert.equal(buyExpansion(state, 'back-left'), true);
    assert.equal(state.gold, 0);
    assert.ok(state.expansions.includes('back-left'));
  });

  it('will not sell a corner pad until it touches an owned room', () => {
    const state = createState();
    state.gold = 50000;
    assert.equal(buyExpansion(state, 'back-left'), false);
    assert.equal(buyExpansion(state, 'back'), true);
    assert.equal(buyExpansion(state, 'back-left'), true);
  });
});

describe('cauldron unlock', () => {
  it('sells one cauldron for 10000 gp and keeps the pose in a save', () => {
    const state = createState();
    assert.equal(ownsCauldron(state), false);
    assert.equal(canBuyCauldron(state), false);
    state.gold = CAULDRON_COST;
    assert.equal(canBuyCauldron(state), true);
    assert.equal(buyCauldron(state, { x: 1.2, z: 0.8, rot: 0 }), true);
    assert.equal(state.gold, 0);
    assert.equal(ownsCauldron(state), true);
    assert.equal(state.furniture.cauldron.x, 1.2);
    assert.equal(canBuyCauldron(state), false);
    const saved = serializeState(state);
    const next = createState();
    assert.equal(applyState(next, saved), true);
    assert.equal(ownsCauldron(next), true);
    assert.equal(next.furniture.cauldron.z, 0.8);
  });

  it('does not sell a cauldron without the gold', () => {
    const state = createState();
    state.gold = CAULDRON_COST - 1;
    assert.equal(buyCauldron(state, { x: 0, z: 0, rot: 0 }), false);
    assert.equal(ownsCauldron(state), false);
  });

  it('brews potions only after a cauldron is placed, using herbs and water', () => {
    const state = createState();
    assert.match(craftBlockReason(state, 'strength_potion'), /cauldron/i);
    assert.match(craftBlockReason(state, 'strength_potion'), /Upgrade/);
    assert.equal(canCraft(state, 'strength_potion'), false);
    assert.equal(isUnlocked(state, 'prayer_potion'), false);
    state.gold = CAULDRON_COST;
    buyCauldron(state, { x: 0, z: 0.8, rot: 0 });
    assert.equal(isUnlocked(state, 'strength_potion'), true);
    assert.equal(isUnlocked(state, 'prayer_potion'), false);
    assert.equal(canCraft(state, 'strength_potion'), true);
    finishCraft(state, 'strength_potion');
    assert.equal(state.chest.strength_potion, 1);
    assert.equal(state.materials.herbs, 7);
    assert.equal(state.materials.water, 11);
    state.craftCounts.strength_potion = 5;
    assert.equal(isUnlocked(state, 'prayer_potion'), true);
  });
});

describe('build furniture', () => {
  it('sells extra tables and mannequins on separate 500 then ×3 curves', () => {
    const state = createState();
    const starterTables = SHOP.displays.filter((d) => d.kind === 'table').length;
    const starterStands = SHOP.displays.filter((d) => d.kind === 'stand').length;
    assert.equal(canBuyFurniture(state, 'table'), false);
    state.gold = 500;
    assert.equal(canBuyFurniture(state, 'table'), true);
    assert.equal(buyFurniture(state, 'table', { x: 0.4, z: 0.2, rot: 0 }), true);
    assert.equal(state.gold, 0);
    assert.equal(state.boughtFurniture.table, 1);
    assert.equal(state.boughtFurniture.mannequin, 0);
    assert.equal(state.displays.length, SHOP.displays.length + 1);
    assert.equal(state.displays.at(-1).kind, 'table');
    assert.equal(state.displays.at(-1).bought, true);
    assert.equal(state.furniture.displays.at(-1).x, 0.4);
    assert.equal(state.displays.filter((d) => d.kind === 'table').length, starterTables + 1);
    assert.equal(state.displays.filter((d) => d.kind === 'stand').length, starterStands);
    state.gold = 1500;
    assert.equal(buyFurniture(state, 'table', { x: 1, z: 1, rot: 0 }), true);
    assert.equal(state.gold, 0);
    assert.equal(state.boughtFurniture.table, 2);
    state.gold = 500;
    assert.equal(buyFurniture(state, 'table', { x: 2, z: 2, rot: 0 }), false);
    assert.equal(buyFurniture(state, 'mannequin', { x: -1, z: 1.2, rot: 0 }), true);
    assert.equal(state.gold, 0);
    assert.equal(state.boughtFurniture.mannequin, 1);
    assert.equal(state.displays.at(-1).kind, 'stand');
    state.gold = 1500;
    assert.equal(buyFurniture(state, 'mannequin', { x: -1.4, z: 1.4, rot: 0 }), true);
    assert.equal(state.gold, 0);
    const saved = serializeState(state);
    const next = createState();
    assert.equal(applyState(next, saved), true);
    assert.equal(next.boughtFurniture.table, 2);
    assert.equal(next.boughtFurniture.mannequin, 2);
    assert.equal(next.displays.length, SHOP.displays.length + 4);
    assert.equal(next.displays.at(-1).kind, 'stand');
    assert.equal(next.furniture.displays.at(-1).z, 1.4);
  });

  it('does not count starter tables or mannequins as paid extras in an old save', () => {
    const state = createState();
    assert.equal(applyState(state, {
      gold: 500,
      displays: SHOP.displays.map(() => ({ ware: null })),
    }), true);
    assert.equal(state.boughtFurniture.table, 0);
    assert.equal(state.boughtFurniture.mannequin, 0);
    assert.equal(state.displays.length, SHOP.displays.length);
    assert.equal(buyFurniture(state, 'table', { x: 0, z: 0.8, rot: 0 }), true);
    assert.equal(state.gold, 0);
    assert.equal(state.boughtFurniture.table, 1);
  });
});
