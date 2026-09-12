import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOMERS,
  MATERIALS,
  METALS,
  RECIPES,
  SHOP,
  SKYBOXES,
  START_GOLD,
  decideRequest,
  formatGold,
  matchingArmourIds,
  mostExpensiveChestId,
  recipeCost,
  recipeList,
  recipesForTab,
  unlockNeed,
  CRAFT_TABS,
  ANVIL_SUBTABS,
  AMMO_BATCH,
  DUNGEON_SKYBOX,
  skyIdForScene,
  anvilSubtabForRecipe,
  costLabel,
  nearestShelfSlot,
  SHELF_SLOT_COUNT,
  SHELF_SLOT_LABELS,
  offerClassOf,
} from './catalog.js';
import {
  applyState,
  applyCheat,
  buyCauldron,
  buyExpansion,
  buyFromCustomer,
  buyFurniture,
  buyFurnace,
  buyWheel,
  canBuyCauldron,
  canBuyFurnace,
  canBuyWheel,
  canRestock,
  canBuyFurniture,
  canCraft,
  CAULDRON_COST,
  WHEEL_COST,
  chestCapacity,
  chestCount,
  chestTotal,
  completeCrafts,
  craftBlockReason,
  craftXp,
  createState,
  decideAfterWait,
  decidePurchase,
  discardFromChest,
  hasStock,
  isUnlocked,
  offerChoices,
  OLD_DEFAULT_DISPLAYS,
  ownsCauldron,
  ownsFurnace,
  ownsWheel,
  placeFromChest,
  placeOnDisplay,
  reducedSalePrice,
  restock,
  sellToCustomer,
  serializeState,
  shopProgress,
  maxCraftActions,
  startCraft,
  startCraftBatch,
  swapOffer,
  tickMaterials,
  unlockRemaining,
  upgradeChest,
} from './economy.js';
import { furnaceBesideAnvil } from './layout.js';
import { QUEUE_AISLE, queueSlot, rectHitsAisle } from './nav.js';
import { DUNGEON_REMAINS } from './shopbuild.js';

function finishCraft(state, recipeId, at = 0) {
  const recipe = RECIPES[recipeId];
  const cost = recipeCost(recipe);
  for (const [id, n] of Object.entries(cost.materials)) {
    state.materials[id] = Math.max(state.materials[id] ?? 0, n);
  }
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
    assert.equal(state.materials.bronze_bar, 0);
    assert.equal(state.materials.bow_string, 0);
    assert.equal(state.materials.flax, 8);
    assert.equal(state.materials.flour, 10);
    assert.equal(state.materials.logs, 8);
    assert.equal(state.materials.hide, 8);
    assert.equal(state.materials.herbs, 8);
    assert.equal(state.materials.water, 12);
    assert.equal(state.materials.essence, 10);
    assert.equal(state.materials.string, undefined);
    assert.equal(MATERIALS.string, undefined);
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
    assert.deepEqual(SHELF_SLOT_LABELS, ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right']);
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
    assert.equal(isUnlocked(state, 'air_rune'), true);
    assert.equal(isUnlocked(state, 'earth_rune'), false);
    assert.equal(isUnlocked(state, 'smelt_bronze'), true);
    assert.equal(isUnlocked(state, 'smelt_iron'), false);
    assert.equal(isUnlocked(state, 'iron_sword'), false);
    assert.equal(isUnlocked(state, 'mystic_staff'), false);
    assert.equal(isUnlocked(state, 'green_dhide_body'), false);
    assert.equal(isUnlocked(state, 'pizza'), false);
    assert.equal(isUnlocked(state, 'salmon'), false);
    assert.equal(isUnlocked(state, 'cake'), false);
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
    state.materials.iron_bar = 1;
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
    state.skybox = 'black';
    state.chefHat = true;
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
    assert.equal(other.skybox, 'black');
    assert.equal(other.chefHat, true);
    assert.ok(other.shopXp > 0);
    assert.equal(other.shopLevel, shopProgress(other.shopXp).level);
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
    assert.equal(state.materials.bronze_bar, 4);
    assert.equal(state.materials.bow_string, 0);
    assert.equal(state.materials.string, undefined);
    assert.equal(state.materials.herbs, 8);
    assert.equal(state.materials.water, 12);
    assert.equal(state.materials.chocolate, MATERIALS.chocolate.start);
    assert.equal(ownsFurnace(state), true);
    assert.equal(state.chest.bread, 2);
    assert.equal(state.fullscreen, false);
    assert.ok(state.music.volume > 0);
    assert.equal(state.skybox, 'blue');
    assert.equal(state.chefHat, false);
    assert.equal(state.shopXp, 0);
    assert.equal(state.shopLevel, 1);
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
        assert.notEqual(id, 'string', `${recipe.id} still uses old String`);
      }
      assert.ok(recipe.time > 0, recipe.id);
      if (recipe.outputMaterial) {
        assert.ok(MATERIALS[recipe.outputMaterial], recipe.id);
        continue;
      }
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
    assert.equal(recipes.filter((r) => r.category === 'ammo').length, 8);
    assert.equal(recipes.filter((r) => r.category === 'rune').length, 4);
    assert.equal(recipes.filter((r) => /d'hide/i.test(r.name)).length, 20);
    assert.equal(RECIPES.blue_dhide_coif.name, "Blue D'hide Coif");
    assert.equal(RECIPES.black_dhide_coif.slot, 'helm');
    assert.equal(RECIPES.bronze_arrows.name, 'Bronze Arrows');
    assert.equal(RECIPES.dragon_arrows.name, 'Dragon Arrows');
    assert.equal(recipes.filter((r) => r.category === 'food').length, 13);
    assert.equal(recipes.filter((r) => r.category === 'potion').length, 8);
    assert.equal(RECIPES.salmon.price, 16);
    assert.ok(RECIPES.salmon.price < RECIPES.cake.price);
    assert.ok(RECIPES.cake.price < RECIPES.lobster.price);
    assert.ok(RECIPES.lobster.price < RECIPES.chocolate_cake.price);
    assert.ok(RECIPES.chocolate_cake.price < RECIPES.monkfish.price);
    assert.ok(RECIPES.monkfish.price < RECIPES.curry.price);
    assert.ok(RECIPES.curry.price < RECIPES.shark.price);
    assert.ok(RECIPES.shark.price < RECIPES.summer_pie.price);
    assert.ok(RECIPES.summer_pie.price < RECIPES.anglerfish.price);
    assert.equal(RECIPES.cake.previousId, 'pizza');
    assert.equal(RECIPES.salmon.previousId, 'bread');
    assert.equal(RECIPES.lobster.previousId, 'salmon');
    assert.equal(RECIPES.chocolate_cake.previousId, 'lobster');
    assert.equal(recipeCost(RECIPES.chocolate_cake).materials.chocolate, 1);
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
    assert.equal(rectHitsAisle(SHOP.furnace.x, SHOP.furnace.z, 0.4, 0.36, QUEUE_AISLE), false);
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
    assert.deepEqual(ANVIL_SUBTABS.map((tab) => tab.label), ['Weapons', 'Armour', 'Ammo', 'Runes']);
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
    assert.equal(recipeCost(RECIPES.bronze_shortbow).materials.bow_string, 1);
    assert.equal(recipeCost(RECIPES.dragon_crossbow).materials.bow_string, 1);
    assert.equal(recipeCost(RECIPES.bronze_sword).materials.bronze_bar, 1);
    assert.equal(recipeCost(RECIPES.bronze_sword).materials.bronze, undefined);
    assert.ok(ranged.some((r) => r.id === 'bronze_arrows'));
    assert.ok(ranged.some((r) => r.id === 'blue_dhide_coif'));
    assert.ok(food.some((r) => r.id === 'bread'));
    assert.ok(food.some((r) => r.id === 'salmon'));
    assert.ok(food.some((r) => r.id === 'anglerfish'));
    assert.equal(food.length, 13);
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

  it('does not regenerate or restock metal bars or bow string', () => {
    const state = createState();
    assert.equal(state.materials.bronze_bar, 0);
    assert.equal(state.materials.bow_string, 0);
    tickMaterials(state, 120);
    assert.equal(state.materials.bronze_bar, 0);
    assert.equal(state.materials.bow_string, 0);
    state.gold = 1000;
    assert.equal(canRestock(state, 'bronze_bar'), false);
    assert.equal(canRestock(state, 'bow_string'), false);
    assert.equal(restock(state, 'bronze_bar'), false);
    assert.equal(restock(state, 'bow_string'), false);
    assert.equal(canRestock(state, 'flax'), true);
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

describe('furnace and spinning wheel', () => {
  it('starts with a free furnace beside the anvil and smelts ore into a bar', () => {
    const state = createState();
    assert.equal(ownsFurnace(state), true);
    assert.equal(canBuyFurnace(state), false);
    assert.equal(buyFurnace(state, { x: -1, z: 0.6, rot: 0 }), false);
    assert.equal(state.furniture.furnace.x, SHOP.furnace.x);
    assert.equal(state.furniture.furnace.z, SHOP.furnace.z);
    const ore = state.materials.bronze;
    assert.equal(canCraft(state, 'smelt_bronze'), true);
    finishCraft(state, 'smelt_bronze');
    assert.equal(state.materials.bronze, ore - 1);
    assert.equal(state.materials.bronze_bar, 1);
    assert.equal(state.chest.smelt_bronze, undefined);
    const saved = serializeState(state);
    const next = createState();
    assert.equal(applyState(next, saved), true);
    assert.equal(ownsFurnace(next), true);
    assert.equal(next.furniture.furnace.x, SHOP.furnace.x);
    assert.equal(next.materials.bronze_bar, 1);
  });

  it('keeps a furnace the player already placed and auto-places one if a save never had one', () => {
    const kept = createState();
    assert.equal(applyState(kept, {
      version: 8,
      gold: 40,
      furniture: {
        anvil: { x: -2.98, z: -2.42, rot: 0 },
        furnace: { x: -1, z: 0.6, rot: 0 },
      },
    }), true);
    assert.equal(kept.furniture.furnace.x, -1);
    assert.equal(kept.furniture.furnace.z, 0.6);

    const missing = createState();
    assert.equal(applyState(missing, {
      version: 8,
      gold: 40,
      furniture: {
        anvil: { x: -2.98, z: -2.42, rot: 0 },
      },
    }), true);
    const expected = furnaceBesideAnvil({ x: -2.98, z: -2.42, rot: 0 });
    assert.equal(missing.furniture.furnace.x, expected.x);
    assert.equal(missing.furniture.furnace.z, expected.z);
    assert.equal(ownsFurnace(missing), true);
  });

  it('unlocks feast foods after bread without changing the kitchen cake line', () => {
    const state = createState();
    assert.equal(isUnlocked(state, 'salmon'), false);
    assert.equal(isUnlocked(state, 'pizza'), false);
    state.craftCounts.bread = 20;
    assert.equal(isUnlocked(state, 'salmon'), true);
    assert.equal(isUnlocked(state, 'pizza'), true);
    assert.equal(isUnlocked(state, 'cake'), false);
    assert.equal(isUnlocked(state, 'lobster'), false);
    state.craftCounts.pizza = 30;
    assert.equal(isUnlocked(state, 'cake'), true);
    state.craftCounts.salmon = 20;
    assert.equal(isUnlocked(state, 'lobster'), true);
    assert.ok(CUSTOMERS.pilgrim.prefers.includes('salmon'));
    assert.ok(CUSTOMERS.pilgrim.prefers.includes('anglerfish'));
    assert.equal(state.materials.chocolate, MATERIALS.chocolate.start);
  });

  it('sells a spinning wheel for 500 gp and spins flax into bow string', () => {
    const state = createState();
    assert.equal(ownsWheel(state), false);
    assert.match(craftBlockReason(state, 'spin_bow_string'), /spinning wheel/i);
    state.gold = WHEEL_COST;
    assert.equal(canBuyWheel(state), true);
    assert.equal(buyWheel(state, { x: 1.1, z: 0.4, rot: 0 }), true);
    assert.equal(state.gold, 0);
    const flax = state.materials.flax;
    finishCraft(state, 'spin_bow_string');
    assert.equal(state.materials.flax, flax - 1);
    assert.equal(state.materials.bow_string, 1);
    assert.equal(state.chest.spin_bow_string, undefined);
  });

  it('requires bow string on every bow and crossbow tier', () => {
    for (const metal of METALS) {
      for (const piece of ['shortbow', 'longbow', 'crossbow']) {
        const recipe = RECIPES[`${metal.id}_${piece}`];
        assert.ok(recipe, `${metal.id}_${piece}`);
        assert.equal(recipeCost(recipe).materials.bow_string, 1, recipe.id);
        assert.equal(recipeCost(recipe).materials.string, undefined, recipe.id);
        assert.ok(recipeCost(recipe).materials[`${metal.id}_bar`] >= 1, recipe.id);
      }
    }
  });

  it('does not turn old String stock into free bow string', () => {
    const state = createState();
    assert.equal(applyState(state, {
      version: 7,
      gold: 40,
      materials: { bronze: 9, string: 40, flax: 3 },
    }), true);
    assert.equal(state.materials.string, undefined);
    assert.equal(state.materials.bow_string, 0);
    assert.equal(state.materials.bronze_bar, 9);
    assert.equal(state.materials.flax, 3);
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
      displays: Array.from({ length: OLD_DEFAULT_DISPLAYS }, () => ({ ware: null })),
    }), true);
    assert.equal(state.boughtFurniture.table, 0);
    assert.equal(state.boughtFurniture.mannequin, 0);
    assert.equal(state.displays.length, SHOP.displays.length);
    assert.equal(buyFurniture(state, 'table', { x: 0, z: 0.8, rot: 0 }), true);
    assert.equal(state.gold, 0);
    assert.equal(state.boughtFurniture.table, 1);
  });
});

describe('gold formatting', () => {
  it('adds commas only for amounts of 1000 or more', () => {
    assert.equal(formatGold(40), '40');
    assert.equal(formatGold(999), '999');
    assert.equal(formatGold(1000), '1,000');
    assert.equal(formatGold(10000), '10,000');
    assert.equal(formatGold(1500), '1,500');
  });
});

describe('shop XP', () => {
  it('grants more XP for higher-tier crafts and caps at level 99', () => {
    const bread = craftXp(RECIPES.bread);
    const dragon = craftXp(RECIPES.dragon_sword);
    assert.ok(dragon > bread);
    const state = createState();
    assert.equal(state.shopLevel, 1);
    assert.equal(state.shopXp, 0);
    finishCraft(state, 'bread');
    assert.equal(state.shopXp, bread);
    assert.equal(state.shopLevel, shopProgress(state.shopXp).level);
    state.shopXp = 0;
    for (let i = 1; i < 200; i += 1) state.shopXp += 5000;
    const maxed = shopProgress(state.shopXp);
    assert.equal(maxed.level, 99);
    assert.equal(maxed.t, 1);
  });
});

describe('cheat codes', () => {
  it('applies motherlode, maxcape, onesmallfavour, and freshstart case-insensitively', () => {
    const state = createState();
    const gold = state.gold;
    assert.equal(applyCheat(state, 'MoThErLoDe'), 'motherlode');
    assert.equal(state.gold, gold + 10000);
    assert.equal(applyCheat(state, 'onesmallfavour'), 'onesmallfavour');
    assert.equal(state.chefHat, true);
    assert.equal(applyCheat(state, 'MAXCAPE'), 'maxcape');
    assert.equal(isUnlocked(state, 'dragon_sword'), true);
    assert.equal(isUnlocked(state, 'runite_platebody'), true);
    state.gold = 80;
    state.chest.bread = 4;
    assert.equal(applyCheat(state, 'freshstart'), 'freshstart');
    assert.equal(state.gold, START_GOLD);
    assert.equal(state.chest.bread, undefined);
    assert.equal(state.chefHat, false);
    assert.equal(state.shopXp, 0);
  });

  it('subtracts gold for -motherlode and clamps at zero', () => {
    const state = createState();
    state.gold = 500;
    assert.equal(applyCheat(state, '-Motherlode'), '-motherlode');
    assert.equal(state.gold, 0);
    state.gold = 25000;
    assert.equal(applyCheat(state, '-motherlode'), '-motherlode');
    assert.equal(state.gold, 15000);
  });
});

describe('center wall shelf save migration', () => {
  it('keeps a bought table when loading a version 5 save with eight default displays', () => {
    const state = createState();
    assert.equal(applyState(state, {
      version: 5,
      gold: 40,
      displays: [
        ...Array.from({ length: 8 }, () => ({ ware: null })),
        { kind: 'table', name: 'Table 1', bought: true, ware: null },
      ],
      furniture: {
        counter: { x: 0, z: -1.72, rot: 0 },
        anvil: { x: -2.98, z: -2.42, rot: 0 },
        chest: { x: 2.98, z: -2.42, rot: 0 },
        range: { x: 1.92, z: -2.22, rot: 0 },
        displays: [
          ...SHOP.displays.slice(0, 8).map((spot) => ({ x: spot.x, z: spot.z, rot: 0 })),
          { x: 0.4, z: 0.2, rot: 0 },
        ],
      },
      boughtFurniture: { table: 1, mannequin: 0 },
    }), true);
    assert.equal(state.displays.length, SHOP.displays.length + 1);
    const center = SHOP.displays.findIndex((d) => d.id === 'shelf-center');
    assert.ok(center >= 0);
    assert.equal(state.displays[center].kind, 'shelf');
    assert.equal(state.displays.at(-1).kind, 'table');
    assert.equal(state.displays.at(-1).bought, true);
    assert.equal(state.furniture.displays.at(-1).x, 0.4);
  });
});

describe('default display order', () => {
  it('appends the extra back-wall shelf after the original eight displays', () => {
    assert.equal(SHOP.displays.length, 9);
    assert.equal(SHOP.displays[6].id, 'stand-left');
    assert.equal(SHOP.displays[7].id, 'stand-right');
    assert.equal(SHOP.displays[8].id, 'shelf-center');
    assert.equal(SHOP.displays[8].kind, 'shelf');
  });
});

describe('ores, appearance, king, and chest bin', () => {
  it('names metal materials as ore and matching bars', () => {
    assert.equal(MATERIALS.bronze.name, 'Bronze Ore');
    assert.equal(MATERIALS.runite.name, 'Runite Ore');
    assert.equal(MATERIALS.dragon.name, 'Dragon Ore');
    assert.equal(MATERIALS.bronze_bar.name, 'Bronze Bar');
    assert.equal(MATERIALS.runite_bar.name, 'Runite Bar');
    assert.equal(MATERIALS.dragon_bar.name, 'Dragon Bar');
    assert.equal(MATERIALS.bow_string.name, 'Bow String');
    assert.equal(MATERIALS.flax.name, 'Flax');
    assert.equal(MATERIALS.chocolate.name, 'Chocolate');
    assert.equal(MATERIALS.string, undefined);
  });

  it('lists peach among skyboxes', () => {
    assert.ok(SKYBOXES.some((item) => item.id === 'peach'));
    assert.equal(SKYBOXES.find((item) => item.id === 'blue').id, 'blue');
  });

  it('saves and loads player appearance and play time', () => {
    const state = createState();
    state.appearance = { hair: 'bun', shirt: 'red', legs: 'navy', boots: 'tan', faceHair: 'beard' };
    state.playTime = 120;
    const data = serializeState(state);
    assert.equal(data.appearance.hair, 'bun');
    assert.equal(data.appearance.shirt, 'red');
    const next = createState();
    assert.equal(applyState(next, data), true);
    assert.equal(next.appearance.hair, 'bun');
    assert.equal(next.appearance.faceHair, 'beard');
    assert.equal(next.playTime, 120);
  });

  it('lets King Roald ask for the most expensive chest ware', () => {
    const state = createState();
    state.chest.bread = 8;
    state.chest.dragon_2h_sword = 1;
    assert.equal(mostExpensiveChestId(state), 'dragon_2h_sword');
    const req = decideRequest('kingroald', Math.random, state);
    assert.equal(req.recipeId, 'dragon_2h_sword');
    assert.equal(req.royal, true);
    assert.equal(CUSTOMERS.kingroald.name, 'King Roald');
  });

  it('discards a chest ware', () => {
    const state = createState();
    finishCraft(state, 'bread');
    finishCraft(state, 'bread');
    assert.equal(discardFromChest(state, 'bread', 1), 1);
    assert.equal(chestCount(state, 'bread'), 1);
  });

  it('clears the middle back-wall shelf when expanding behind the shop', () => {
    const state = createState();
    const center = SHOP.displays.findIndex((d) => d.id === 'shelf-center');
    finishCraft(state, 'bread');
    finishCraft(state, 'bread');
    state.displays[center].shelfSlots = ['bread', 'bread', null, null];
    state.chest.bread = 0;
    state.gold = 10000;
    assert.equal(buyExpansion(state, 'back'), true);
    assert.equal(state.displays[center].removed, true);
    assert.equal(chestCount(state, 'bread'), 2);
  });
});

describe('furnace bar unlocks', () => {
  it('unlocks iron after 20 bronze smelts, then steel after 30 iron smelts', () => {
    const state = createState();
    assert.equal(isUnlocked(state, 'smelt_bronze'), true);
    assert.equal(isUnlocked(state, 'smelt_iron'), false);
    assert.equal(unlockRemaining(state, 'smelt_iron'), 20);
    state.materials.bronze = 40;
    for (let i = 0; i < 19; i += 1) finishCraft(state, 'smelt_bronze', i);
    assert.equal(isUnlocked(state, 'smelt_iron'), false);
    finishCraft(state, 'smelt_bronze', 20);
    assert.equal(state.craftCounts.smelt_bronze, 20);
    assert.equal(isUnlocked(state, 'smelt_iron'), true);
    assert.equal(isUnlocked(state, 'smelt_steel'), false);
    state.materials.iron = 40;
    state.craftCounts.smelt_iron = 29;
    finishCraft(state, 'smelt_iron');
    assert.equal(isUnlocked(state, 'smelt_steel'), true);
    const saved = serializeState(state);
    const next = createState();
    assert.equal(applyState(next, saved), true);
    assert.equal(next.craftCounts.smelt_bronze, 20);
    assert.equal(isUnlocked(next, 'smelt_iron'), true);
    assert.equal(isUnlocked(createState(), 'smelt_iron'), false);
  });
});

describe('ranged ammo', () => {
  it('puts arrows and cannonballs on the ammo subtab and crafts twenty at a time', () => {
    const weapons = recipesForTab('ranged', 'weapon');
    const ammo = recipesForTab('ranged', 'ammo');
    assert.ok(!weapons.some((r) => r.id === 'bronze_arrows'));
    assert.ok(ammo.every((r) => r.category === 'ammo'));
    assert.ok(ammo.some((r) => r.id === 'bronze_arrows'));
    assert.ok(ammo.some((r) => r.id === 'runite_arrows'));
    assert.equal(RECIPES.runite_arrows.name, 'Runite Arrows');
    assert.ok(ammo.some((r) => r.id === 'cannonballs'));
    assert.equal(RECIPES.bronze_arrows.outputCount, AMMO_BATCH);
    assert.equal(RECIPES.cannonballs.outputCount, AMMO_BATCH);
    assert.equal(recipeCost(RECIPES.bronze_arrows).materials.bronze_bar, 1);
    assert.equal(recipeCost(RECIPES.bronze_arrows).materials.logs, 1);
    assert.equal(recipeCost(RECIPES.cannonballs).materials.steel_bar, 1);
    assert.equal(anvilSubtabForRecipe(RECIPES.bronze_arrows), 'ammo');
    const state = createState();
    state.materials.bronze_bar = 1;
    state.materials.logs = 2;
    finishCraft(state, 'bronze_arrows');
    assert.equal(state.chest.bronze_arrows, 20);
    assert.equal(state.craftCounts.bronze_arrows, 1);
    assert.equal(isUnlocked(state, 'iron_arrows'), false);
    state.craftCounts.bronze_arrows = 20;
    assert.equal(isUnlocked(state, 'iron_arrows'), true);
    assert.match(costLabel(RECIPES.bronze_arrows), /×20/);
    assert.match(costLabel(RECIPES.bronze_arrows), /sells 2g/);
  });
});

describe('magic runes', () => {
  it('unlocks Air then Earth then Water then Fire on the weapon craft-count ladder', () => {
    const runes = recipesForTab('magic', 'rune');
    assert.deepEqual(runes.map((r) => r.id), ['air_rune', 'earth_rune', 'water_rune', 'fire_rune']);
    assert.equal(anvilSubtabForRecipe(RECIPES.air_rune), 'rune');
    const state = createState();
    assert.equal(isUnlocked(state, 'air_rune'), true);
    assert.equal(isUnlocked(state, 'earth_rune'), false);
    assert.equal(unlockRemaining(state, 'earth_rune'), 20);
    state.materials.essence = 80;
    for (let i = 0; i < 19; i += 1) finishCraft(state, 'air_rune', i);
    assert.equal(isUnlocked(state, 'earth_rune'), false);
    finishCraft(state, 'air_rune', 20);
    assert.equal(state.chest.air_rune, 20);
    assert.equal(state.craftCounts.air_rune, 20);
    assert.equal(isUnlocked(state, 'earth_rune'), true);
    assert.equal(isUnlocked(state, 'water_rune'), false);
    state.craftCounts.earth_rune = 29;
    finishCraft(state, 'earth_rune');
    assert.equal(isUnlocked(state, 'water_rune'), true);
    assert.equal(isUnlocked(state, 'fire_rune'), false);
    state.craftCounts.water_rune = 40;
    assert.equal(isUnlocked(state, 'fire_rune'), true);
    assert.ok(CUSTOMERS.hedgemage.prefers.includes('air_rune'));
    assert.ok(CUSTOMERS.pilgrim.prefers.includes('fire_rune'));
    const saved = serializeState(state);
    const next = createState();
    assert.equal(applyState(next, saved), true);
    assert.equal(next.craftCounts.air_rune, 20);
    assert.equal(isUnlocked(next, 'earth_rune'), true);
  });
});

describe('potion sell prices', () => {
  it('starts at 1,000g and climbs by rarity, with comma labels and offer markdown', () => {
    const prices = [
      RECIPES.strength_potion.price,
      RECIPES.prayer_potion.price,
      RECIPES.attack_potion.price,
      RECIPES.anti_poison_potion.price,
      RECIPES.ranging_potion.price,
      RECIPES.antifire_potion.price,
      RECIPES.energy_potion.price,
      RECIPES.magic_potion.price,
    ];
    assert.equal(prices[0], 1000);
    for (let i = 1; i < prices.length; i += 1) {
      assert.ok(prices[i] > prices[i - 1], `${i} should sell for more`);
    }
    assert.match(costLabel(RECIPES.strength_potion), /sells 1,000g/);
    assert.match(costLabel(RECIPES.magic_potion), /sells 16,000g/);
    const ask = decideRequest('hedgemage', () => 0.9, createState());
    if (ask.recipeId === 'magic_potion' || RECIPES[ask.recipeId]?.category === 'potion') {
      assert.equal(ask.gold, RECIPES[ask.recipeId].price);
    }
    assert.equal(reducedSalePrice(RECIPES.strength_potion.price), 650);
    const state = createState();
    state.gold = 20000;
    state.furniture.cauldron = { x: 0, z: 0, rot: 0 };
    finishCraft(state, 'strength_potion');
    const offer = offerChoices(state, 'prayer_potion')[0];
    assert.equal(offer.recipeId, 'strength_potion');
    assert.equal(offer.listPrice, 1000);
    assert.equal(offer.gold, 650);
  });
});

describe('craft batches', () => {
  it('queues five affordable crafts and finishes them in sequence', () => {
    const state = createState();
    state.materials.bronze_bar = 8;
    assert.equal(maxCraftActions(state, 'bronze_sword'), 8);
    assert.equal(startCraftBatch(state, 'bronze_sword', 5, 0), 5);
    assert.equal(state.materials.bronze_bar, 3);
    assert.equal(state.crafts.bronze_sword.left, 5);
    assert.equal(state.chest.bronze_sword, undefined);
    assert.deepEqual(completeCrafts(state, 2.9), []);
    assert.deepEqual(completeCrafts(state, 3), ['bronze_sword']);
    assert.equal(state.chest.bronze_sword, 1);
    assert.equal(state.crafts.bronze_sword.left, 4);
    assert.deepEqual(completeCrafts(state, 3 + RECIPES.bronze_sword.time * 4), [
      'bronze_sword', 'bronze_sword', 'bronze_sword', 'bronze_sword',
    ]);
    assert.equal(state.chest.bronze_sword, 5);
    assert.equal(state.crafts.bronze_sword, undefined);
    assert.equal(state.craftCounts.bronze_sword, 5);
  });

  it('caps Max by materials and does not craft locked tiers', () => {
    const state = createState();
    state.materials.bronze_bar = 2;
    state.materials.logs = 40;
    assert.equal(maxCraftActions(state, 'bronze_arrows'), 2);
    assert.equal(startCraftBatch(state, 'bronze_arrows', 'max', 0), 2);
    assert.equal(completeCrafts(state, 100).length, 2);
    assert.equal(state.chest.bronze_arrows, 40);
    assert.equal(state.craftCounts.bronze_arrows, 2);
    assert.equal(maxCraftActions(state, 'iron_arrows'), 0);
    assert.equal(startCraftBatch(state, 'iron_arrows', 5, 0), 0);
  });
});

describe('dungeon sky and remains', () => {
  it('uses dark grey inside the dungeon and restores the saved overworld sky', () => {
    assert.equal(DUNGEON_SKYBOX, 'dark-grey');
    assert.equal(skyIdForScene('dungeon', 'peach'), 'dark-grey');
    assert.equal(skyIdForScene('shop', 'peach'), 'peach');
    assert.equal(skyIdForScene('shop', 'nope'), 'blue');
    assert.ok(DUNGEON_REMAINS.length >= 8);
    assert.ok(DUNGEON_REMAINS.some((spot) => spot.kind === 'slump'));
    assert.ok(DUNGEON_REMAINS.some((spot) => spot.kind === 'pile'));
  });
});

