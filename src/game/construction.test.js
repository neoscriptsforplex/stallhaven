import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONSTRUCTION_GUIDE,
  CONSTRUCTION_PIECES,
  constructionPiece,
  constructionXpFor,
  missingMaterials,
  moveConstruction,
  pickupConstruction,
  placeConstruction,
  sellConstruction,
} from './construction.js';
import { SAVE_VERSION, applyState, createState, serializeState } from './economy.js';
import { applyIntent } from './intents.js';
import { SKILL_GUIDES } from './skillGuideData.js';
import { xpForLevel } from './skills.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../public/models/furniture');

function funded() {
  const state = createState();
  for (const id of ['plank', 'oak_plank', 'willow_plank', 'maple_plank', 'yew_plank', 'magic_plank', 'logs', 'flax', 'steel_bar', 'bronze_nails', 'iron_nails', 'steel_nails', 'mithril_nails', 'adamant_nails', 'dragon_nails']) {
    state.materials[id] = 40;
  }
  return state;
}

describe('construction catalogue', () => {
  it('lists the thirty-four cosmetic pieces at flat material prices', () => {
    assert.equal(CONSTRUCTION_PIECES.length, 34);
    assert.equal(constructionPiece('chair').materials.plank, 1);
    assert.equal(constructionPiece('chair').gold, 200);
    assert.equal(new Set(CONSTRUCTION_PIECES.map((row) => row.id)).size, 34);
    const chair = funded();
    chair.materials.plank = 1;
    chair.materials.bronze_nails = 2;
    const before = chair.skills.getXp('construction');
    assert.equal(placeConstruction(chair, 'chair', { x: 1, z: 1, rot: 0 }), true);
    assert.equal(chair.materials.plank, 0);
    assert.equal(chair.materials.bronze_nails, 0);
    assert.equal(chair.gold, funded().gold);
    assert.equal(chair.furniture.placed.length, 1);
    assert.equal(chair.skills.getXp('construction') - before, constructionXpFor(constructionPiece('chair')));
    assert.equal(placeConstruction(chair, 'chair', { x: 2, z: 1, rot: 0 }), false);
  });

  it('picks materials back up and sells for half the gold', () => {
    const state = funded();
    placeConstruction(state, 'crate', { x: 0.2, z: 0.4, rot: 0 });
    const gold = state.gold;
    const planks = state.materials.plank;
    assert.equal(sellConstruction(state, 0), Math.floor(constructionPiece('crate').gold / 2));
    assert.equal(state.gold, gold + Math.floor(constructionPiece('crate').gold / 2));
    assert.equal(state.materials.plank, planks, 'sell does not return planks');
    assert.equal(state.furniture.placed.length, 0);

    placeConstruction(state, 'crate', { x: 0.2, z: 0.4, rot: 0 });
    state.materials.plank = 0;
    state.materials.bronze_nails = 0;
    assert.equal(pickupConstruction(state, 0), true);
    assert.equal(state.materials.plank, 2);
    assert.equal(state.materials.bronze_nails, 2);
    assert.equal(state.furniture.placed.length, 0);
  });

  it('moves without spending and keeps the piece in the save', () => {
    assert.equal(SAVE_VERSION, 15);
    const state = funded();
    placeConstruction(state, 'bush', { x: -2, z: 9, rot: 0.2 });
    const xp = state.skills.getXp('construction');
    assert.equal(moveConstruction(state, 0, { x: -1, z: 8, rot: 1 }), true);
    assert.equal(state.skills.getXp('construction'), xp);
    assert.equal(state.materials.flax, 38);
    const next = createState();
    assert.equal(applyState(next, serializeState(state)), true);
    assert.deepEqual(next.furniture.placed[0], { id: 'bush', x: -1, z: 8, rot: 1 });
    const old = serializeState(createState());
    old.version = 13;
    delete old.furniture.placed;
    const migrated = createState();
    applyState(migrated, old);
    assert.deepEqual(migrated.furniture.placed, []);
  });

  it('locks wall decor behind Construction level and lets only the host place it', () => {
    const state = funded();
    assert.equal(placeConstruction(state, 'portrait', { x: 1, z: 0, rot: 0 }), false);
    state.materials.oak_plank = 0;
    assert.ok(missingMaterials(state, constructionPiece('portrait')).some((row) => row.id === 'oak_plank'));
    state.materials.oak_plank = 40;
    state.skills.addXp('construction', xpForLevel(5));
    assert.equal(placeConstruction(state, 'portrait', { x: 1, z: 0, rot: 0 }), true);
    const guest = applyIntent(createState(), {
      type: 'placePiece',
      pieceId: 'chair',
      pose: { x: 0, z: 0, rot: 0 },
    }, { coop: true, host: false });
    assert.equal(guest.ok, false);
    assert.equal(guest.reason, 'host-only');
    const host = funded();
    host.skills.addXp('construction', xpForLevel(5));
    const allowed = applyIntent(host, {
      type: 'placePiece',
      pieceId: 'portrait',
      pose: { x: 1.2, z: 0.2, rot: 0 },
    }, { coop: true, host: true });
    assert.equal(allowed.ok, true);
    assert.equal(host.furniture.placed[0].id, 'portrait');
  });

  it('replaces the coming-soon wall rows and ships a model or a box fallback', () => {
    const builds = SKILL_GUIDES.construction.tabs.find((tab) => tab.id === 'builds');
    for (const row of CONSTRUCTION_GUIDE) {
      const live = builds.rows.find((item) => item.name === row.name);
      assert.equal(live?.lv, row.lv, row.name);
      assert.equal(live?.soon, undefined, row.name);
    }
    assert.equal(builds.rows.some((row) => row.name === 'Wall Plant'), false);
    const withModel = ['chair', 'portrait', 'tapestry', 'lumbridge_fountain'];
    for (const id of withModel) {
      assert.equal(existsSync(join(root, id, `${id}.obj`)), true, id);
    }
    assert.equal(existsSync(join(root, 'cabinet', 'cabinet.obj')), false);
    assert.equal(existsSync(join(root, 'flag_pole', 'flag_pole.obj')), false);
  });
});
