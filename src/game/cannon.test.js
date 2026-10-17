import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import './canvas-mock.js';
import * as THREE from 'three';
import {
  CUSTOMERS,
  MATERIALS,
  RECIPES,
  SHOP,
  canDisplayOn,
  costLabel,
  isCraftHidden,
  isMinedMaterial,
  offerClassOf,
  recipeCost,
  recipeList,
  recipesForTab,
  stationForRecipe,
} from './catalog.js';
import {
  SAVE_VERSION,
  addToChest,
  applyState,
  canRestock,
  craftBlockReason,
  createState,
  grantDwarvenPlans,
  maxCraftActions,
  offerChoices,
  placeFromChest,
  reducedSalePrice,
  serializeState,
} from './economy.js';
import { OSRS_MODEL_SCALE, buildWare, setBundledLook } from './models.js';
import { xpForLevel } from './skills.js';
import { parseModelBuffer } from './upload.js';

const modelsRoot = join(dirname(fileURLToPath(import.meta.url)), '../../public/models');

describe('dwarven multicannon', () => {
  it('is the next fletching weapon after the crossbows', () => {
    const recipe = RECIPES.dwarven_multicannon;
    assert.equal(recipe.name, 'Dwarven Multicannon');
    assert.equal(recipe.tier, 8);
    assert.ok(recipe.tier > RECIPES.dragon_crossbow.tier);
    assert.equal(stationForRecipe(recipe), 'fletch');
    assert.equal(isCraftHidden(recipe), false);
    assert.equal(recipe.noMannequin, true);
    const weapons = recipesForTab('ranged', 'weapon');
    const ammo = recipesForTab('ranged', 'ammo');
    const at = weapons.findIndex((item) => item.id === 'dragon_crossbow');
    assert.ok(at >= 0);
    assert.equal(weapons[at + 1].id, 'dwarven_multicannon');
    assert.equal(ammo.some((item) => item.id === 'dwarven_multicannon'), false);
  });

  it('costs 5000 steel bars, cannonballs, and one Dwarven Plans, and needs Smithing 99', () => {
    const cost = recipeCost(RECIPES.dwarven_multicannon);
    assert.deepEqual(RECIPES.dwarven_multicannon.requires, { skill: 'smithing', level: 99 });
    assert.equal(cost.materials.steel_bar, 5000);
    assert.equal(cost.materials.dwarven_plans, 1);
    assert.equal(cost.items.cannonballs, 5000);
    assert.equal(RECIPES.dwarven_multicannon.price, 750000);
    assert.equal(reducedSalePrice(750000), 487500);
    assert.deepEqual(RECIPES.dwarven_multicannon.buyers, ['ranger']);
    assert.equal(offerClassOf(RECIPES.dwarven_multicannon), 'ranged');
    assert.equal(CUSTOMERS.ranger.prefers.includes('dwarven_multicannon'), true);
    assert.equal(CUSTOMERS.mercenary.prefers.includes('dwarven_multicannon'), false);
    const label = costLabel(RECIPES.dwarven_multicannon);
    assert.match(label, /Steel Bar ×5000/);
    assert.match(label, /Dwarven Plans ×1/);
    assert.match(label, /Cannonballs ×5000/);
    assert.match(label, /sells 750,000g/);

    const state = createState();
    state.furniture.fletch = { x: 0, z: 0, rot: 0 };
    state.materials.steel_bar = 5000;
    state.materials.dwarven_plans = 1;
    addToChest(state, 'cannonballs', 5000);
    assert.equal(craftBlockReason(state, 'dwarven_multicannon'), 'Requires level 99 Smithing');
    assert.equal(maxCraftActions(state, 'dwarven_multicannon'), 0);
    state.skills.addXp('smithing', xpForLevel(99));
    assert.equal(state.skills.getLevel('smithing'), 99);
    state.materials.steel_bar = 0;
    state.materials.dwarven_plans = 0;
    state.chest.cannonballs = 0;
    assert.match(craftBlockReason(state, 'dwarven_multicannon'), /Steel Bar/);
    state.materials.steel_bar = 5000;
    assert.match(craftBlockReason(state, 'dwarven_multicannon'), /Dwarven Plans/);
    state.materials.dwarven_plans = 1;
    assert.match(craftBlockReason(state, 'dwarven_multicannon'), /Cannonballs/);

    addToChest(state, 'dwarven_multicannon');
    addToChest(state, 'shortbow');
    const offer = offerChoices(state, 'shortbow').find((item) => item.recipeId === 'dwarven_multicannon');
    assert.equal(offer.gold, 487500);
    assert.equal(offer.listPrice, 750000);
  });

  it('sits on tables and shelves and never on a mannequin', () => {
    const recipe = RECIPES.dwarven_multicannon;
    assert.equal(canDisplayOn('table', recipe), true);
    assert.equal(canDisplayOn('shelf', recipe), true);
    assert.equal(canDisplayOn('stand', recipe), false);

    const state = createState();
    addToChest(state, 'dwarven_multicannon');
    const stand = SHOP.displays.findIndex((display) => display.kind === 'stand');
    const table = SHOP.displays.findIndex((display) => display.kind === 'table');
    const shelf = SHOP.displays.findIndex((display) => display.kind === 'shelf');
    assert.equal(placeFromChest(state, 'dwarven_multicannon', stand), false);
    assert.equal(state.displays[stand].ware, null);
    assert.equal(state.chest.dwarven_multicannon, 1);
    assert.equal(placeFromChest(state, 'dwarven_multicannon', table), true);
    assert.equal(state.displays[table].ware.recipeId, 'dwarven_multicannon');
    addToChest(state, 'dwarven_multicannon');
    assert.equal(placeFromChest(state, 'dwarven_multicannon', shelf), true);
    assert.equal(state.displays[shelf].shelfSlots.includes('dwarven_multicannon'), true);
  });
});

describe('dwarven plans', () => {
  it('starts at zero, cannot be bought or gathered, and can be granted for a later quest', () => {
    const mat = MATERIALS.dwarven_plans;
    assert.equal(mat.name, 'Dwarven Plans');
    assert.equal(mat.start, 0);
    assert.equal(mat.restock, 0);
    assert.equal(mat.quest, true);
    assert.equal(isMinedMaterial('dwarven_plans'), false);
    assert.equal(mat.crafted, undefined);
    assert.equal(recipeList().some((recipe) => recipe.outputMaterial === 'dwarven_plans'), false);
    assert.equal(createState().materials.dwarven_plans, 0);

    const state = createState();
    assert.equal(canRestock(state, 'dwarven_plans'), false);
    assert.equal(grantDwarvenPlans(state, 1), 1);
    assert.equal(state.materials.dwarven_plans, 1);
    assert.equal(grantDwarvenPlans(state, 2), 2);
    assert.equal(state.materials.dwarven_plans, 3);
    assert.equal(grantDwarvenPlans(state, 0), 0);
    assert.equal(state.materials.dwarven_plans, 3);
  });

  it('stays zero on an older save without bumping the save version', () => {
    assert.equal(SAVE_VERSION, 10);
    const state = createState();
    state.materials.bow_string = 4;
    state.materials.logs = 3;
    const saved = serializeState(state);
    delete saved.materials.dwarven_plans;
    const next = createState();
    next.materials.bow_string = 9;
    assert.equal(applyState(next, saved), true);
    assert.equal(next.materials.dwarven_plans, 0);
    assert.equal(next.materials.bow_string, 4);
    assert.equal(next.materials.logs, 3);
  });
});

describe('dwarven multicannon model', () => {
  it('wraps the bundled dump at the OSRS unit scale', async () => {
    const folder = join(modelsRoot, 'gear/dwarven-multicannon');
    const obj = readFileSync(join(folder, 'dwarven-multicannon.obj'));
    const mtl = readFileSync(join(folder, 'dwarven-multicannon.mtl'));
    const dump = await parseModelBuffer(
      obj.buffer.slice(obj.byteOffset, obj.byteOffset + obj.byteLength),
      'dwarven-multicannon.obj',
      { 'dwarven-multicannon.mtl': mtl.buffer.slice(mtl.byteOffset, mtl.byteOffset + mtl.byteLength) },
    );
    dump.updateMatrixWorld(true);
    const raw = new THREE.Box3().setFromObject(dump).getSize(new THREE.Vector3());
    const rawMax = Math.max(raw.x, raw.y, raw.z);
    setBundledLook('dwarven_multicannon', dump);
    try {
      const ware = buildWare('dwarven_multicannon');
      const mesh = ware.getObjectByName('dump');
      assert.ok(mesh);
      const scale = mesh.scale;
      assert.ok(Math.abs(scale.x - scale.y) < 1e-4 && Math.abs(scale.y - scale.z) < 1e-4);
      const box = new THREE.Box3().setFromObject(ware);
      const size = box.getSize(new THREE.Vector3());
      const gotMax = Math.max(size.x, size.y, size.z);
      assert.ok(Math.abs(gotMax - rawMax * OSRS_MODEL_SCALE) < 0.02, `${gotMax} vs ${rawMax * OSRS_MODEL_SCALE}`);
      assert.ok(Math.abs(box.min.y) < 0.02);
      assert.ok(size.y < Math.max(size.x, size.z));
    } finally {
      setBundledLook('dwarven_multicannon', null);
    }
  });
});
