import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SHOP } from './catalog.js';
import { createState } from './economy.js';
import {
  STATION_ARRIVE,
  STATION_HIT,
  USE_KINDS,
  pickUseHit,
  resolveStationUse,
  stationAtFloor,
} from './interact.js';

function hit(kind, distance, x = 0, z = 0) {
  return { distance, object: { userData: { kind } }, point: { x, z } };
}

describe('station walk-then-open', () => {
  it('gives the anvil a larger click box and floor radius than the old 0.62 steal zone', () => {
    assert.ok(STATION_HIT.anvil.w >= 1.4);
    assert.ok(STATION_HIT.anvil.d >= 1.2);
    assert.ok(STATION_HIT.anvil.floorR > 0.62);
    assert.ok(STATION_ARRIVE > 1.15);
  });

  it('lets a ground hit in front of the anvil count as an anvil click', () => {
    const state = createState();
    const near = stationAtFloor(SHOP.anvil.x, SHOP.anvil.z + 0.7, state.furniture);
    assert.equal(near?.type, 'anvil');
    const far = stationAtFloor(0, 2.4, state.furniture);
    assert.equal(far, null);
  });

  it('does not let a closer floor ray steal an anvil pick', () => {
    const picked = pickUseHit([
      hit('ground', 4.1, SHOP.anvil.x, SHOP.anvil.z + 0.2),
      hit('anvil', 4.4, SHOP.anvil.x, SHOP.anvil.z),
    ]);
    assert.equal(picked.object.userData.kind, 'anvil');
  });

  it('still prefers a closer display over a distant anvil behind it', () => {
    const picked = pickUseHit([
      hit('display', 2.1),
      hit('anvil', 5.5),
    ]);
    assert.equal(picked.object.userData.kind, 'display');
  });

  it('opens immediately when already next to the anvil', () => {
    const state = createState();
    const plan = resolveStationUse(
      { x: SHOP.anvil.x, z: SHOP.anvil.z + 0.6 },
      state.furniture.anvil,
      state,
    );
    assert.equal(plan.action, 'open');
  });

  it('retargets a walk to the anvil, furnace, chest, and range from the keeper', () => {
    const state = createState();
    const from = { x: SHOP.keeper.x, z: SHOP.keeper.z };
    for (const id of ['anvil', 'furnace', 'chest', 'range']) {
      const plan = resolveStationUse(from, state.furniture[id], state);
      assert.equal(plan.action, 'walk', `${id} should path from the keeper`);
      assert.ok(plan.path.length >= 1);
    }
  });

  it('walks to an anvil placed in a side expansion', () => {
    const state = createState();
    state.expansions = ['right'];
    state.furniture.anvil = { x: 8.2, z: 0.2, rot: 0 };
    const plan = resolveStationUse(
      { x: SHOP.keeper.x, z: SHOP.keeper.z },
      state.furniture.anvil,
      state,
    );
    assert.equal(plan.action, 'walk');
    const end = plan.path[plan.path.length - 1];
    assert.ok(end.x > 5);
  });

  it('treats dungeon boulders as walk-then-use rocks', () => {
    assert.equal(USE_KINDS.has('boulder'), true);
    assert.ok(STATION_HIT.boulder.w >= 1.2);
    assert.ok(STATION_HIT.boulder.floorR >= 1);
    const picked = pickUseHit([
      hit('ground', 3.2, 0.2, 3.15),
      hit('boulder', 3.4, 0.2, 3.15),
    ]);
    assert.equal(picked.object.userData.kind, 'boulder');
  });
});
