import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SHOP } from './catalog.js';
import { createState } from './economy.js';
import { PLAYER_RADIUS, isWalkable, playerObstacles } from './nav.js';
import { furnitureHalfSize, playerWalkFloors } from './layout.js';
import {
  STATION_ARRIVE,
  STATION_HIT,
  USE_KINDS,
  floorClickPoint,
  ignoredClickObject,
  pickUseHit,
  fletchFaceYaw,
  fletchStandWorld,
  rangeFaceYaw,
  rangeStandWorld,
  resolveStationUse,
  stationAtFloor,
} from './interact.js';

function hit(kind, distance, x = 0, z = 0) {
  return { distance, object: { userData: { kind } }, point: { x, z } };
}

describe('station walk-then-open', () => {
  it('keeps station click boxes on the visible footprint', () => {
    for (const id of ['anvil', 'chest', 'range', 'furnace', 'cauldron', 'wheel', 'loom', 'fletch', 'potter']) {
      const { hw, hd } = furnitureHalfSize(id);
      const hit = STATION_HIT[id];
      assert.ok(hit.w <= hw * 2 + 0.2, `${id} click width`);
      assert.ok(hit.d <= hd * 2 + 0.2, `${id} click depth`);
      assert.ok(hit.w >= hw * 2, `${id} still covers its width`);
      assert.ok(hit.floorR <= Math.hypot(hw, hd) + 0.2, `${id} floor radius`);
      assert.ok(hit.floorR >= Math.hypot(hw, hd), `${id} floor radius still reaches the base`);
    }
    assert.ok(STATION_ARRIVE > 1.15);
    assert.equal(STATION_HIT.wheel.pickY, 1);
  });

  it('does not treat the ground beside a station as a station click', () => {
    const onlyAnvil = { anvil: { x: SHOP.anvil.x, z: SHOP.anvil.z, rot: 0 } };
    const onAnvil = stationAtFloor(SHOP.anvil.x, SHOP.anvil.z + 0.15, onlyAnvil);
    assert.equal(onAnvil?.type, 'anvil');
    const besideAnvil = stationAtFloor(SHOP.anvil.x, SHOP.anvil.z + 0.7, onlyAnvil);
    assert.equal(besideAnvil, null);
    const rangePose = { range: { x: 0, z: 0, rot: 0 } };
    assert.equal(stationAtFloor(0.4, 0, rangePose)?.type, 'range');
    assert.equal(stationAtFloor(1.35, 0, rangePose), null);
    const far = stationAtFloor(0, 2.4, createState().furniture);
    assert.equal(far, null);
  });

  it('treats a rug hit like walkable floor, not furniture', () => {
    const picked = pickUseHit([
      hit('rug', 3.2, 0, 0.25),
      hit('ground', 3.4, 0, 0.25),
    ]);
    assert.equal(picked, null);
    const anvilThroughRug = pickUseHit([
      hit('rug', 4.0, 0, 0.25),
      hit('anvil', 4.4, SHOP.anvil.x, SHOP.anvil.z),
    ]);
    assert.equal(anvilThroughRug.object.userData.kind, 'anvil');
  });

  it('ignores faded roofs and walls and keeps the raised shop floor', () => {
    const roof = {
      name: 'roof-gable',
      visible: true,
      userData: {},
      material: { transparent: true, opacity: 0.15, userData: { isRoof: true } },
      parent: { name: 'roofs', visible: true, userData: { isRoof: true }, parent: null },
    };
    const wall = { name: 'wall', visible: true, userData: { shopWall: true }, material: {}, parent: null };
    const hidden = { name: 'roof', visible: false, userData: {}, material: {}, parent: null };
    assert.equal(ignoredClickObject(roof), true);
    assert.equal(ignoredClickObject(wall), true);
    assert.equal(ignoredClickObject(hidden), true);
    const floor = {
      visible: true,
      userData: { kind: 'ground', shopFloor: 'plank' },
      material: {},
      parent: null,
    };
    const lawn = {
      visible: true,
      name: 'grass-ground',
      userData: { kind: 'ground' },
      material: {},
      parent: null,
    };
    assert.equal(ignoredClickObject(floor), false);
    const point = floorClickPoint([
      { distance: 4.2, point: { x: 0.2, y: -0.02, z: 0.4 }, object: lawn },
      { distance: 4.05, point: { x: 1, y: 2.8, z: 4 }, object: roof },
      { distance: 5.1, point: { x: 0.15, y: 0.1, z: 0.35 }, object: floor },
    ]);
    assert.equal(point.y, 0.1);
    assert.ok(Math.hypot(point.x - 0.15, point.z - 0.35) < 0.01);
    const yard = floorClickPoint([
      { distance: 3, point: { x: 0, y: -0.02, z: 8 }, object: lawn },
      { distance: 8, point: { x: 0, y: 0.1, z: 0 }, object: floor },
    ]);
    assert.equal(yard.z, 8);
  });

  it('keeps the invisible dungeon floor and rock picks, and still prefers shop boards', () => {
    const dungeonFloor = {
      visible: true,
      name: 'dungeon-grounds',
      userData: { kind: 'ground' },
      material: { transparent: true, opacity: 0 },
      parent: { name: 'dungeon-grounds', visible: true, userData: {}, parent: null },
    };
    const rock = {
      visible: true,
      name: 'boulder-bronze',
      userData: { kind: 'boulder', materialId: 'bronze' },
      material: { transparent: true, opacity: 0 },
      parent: null,
    };
    const yardPick = {
      visible: true,
      name: 'grounds',
      userData: { kind: 'ground' },
      material: { transparent: true, opacity: 0 },
      parent: { name: 'grounds', visible: true, userData: {}, parent: null },
    };
    assert.equal(ignoredClickObject(dungeonFloor), false);
    assert.equal(ignoredClickObject(rock), false);
    const boards = {
      visible: true,
      userData: { kind: 'ground', shopFloor: 'plank' },
      material: { transparent: false, opacity: 1 },
      parent: null,
    };
    const point = floorClickPoint([
      { distance: 4.0, point: { x: 0.2, y: 0.02, z: 0.4 }, object: yardPick },
      { distance: 4.35, point: { x: 0.18, y: 0.1, z: 0.36 }, object: boards },
    ]);
    assert.equal(point.y, 0.1);
    const picked = pickUseHit([
      { distance: 5, point: { x: 1.5, y: 0.04, z: -2 }, object: dungeonFloor },
      { distance: 4.2, point: { x: -3.3, y: 0.5, z: -3.1 }, object: rock },
    ]);
    assert.equal(picked.object.userData.kind, 'boulder');
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
    assert.equal(resolveStationUse(from, state.furniture.furnace, state).action, 'none');
    assert.equal(resolveStationUse(from, state.furniture.range, state).action, 'none');
    state.furniture.furnace = { x: SHOP.furnace.x, z: SHOP.furnace.z, rot: 0 };
    state.furniture.range = { x: SHOP.range.x, z: SHOP.range.z, rot: 0 };
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

  it('stands one step in front of the range pan, not at the chimney', () => {
    const state = createState();
    state.furniture.range = { x: SHOP.range.x, z: SHOP.range.z, rot: 0 };
    const from = { x: SHOP.keeper.x, z: SHOP.keeper.z };
    const plan = resolveStationUse(from, state.furniture.range, state, undefined, 'range');
    const stand = rangeStandWorld(state.furniture.range);
    assert.equal(plan.action, 'walk');
    assert.ok(Math.hypot(plan.dest.x - stand.x, plan.dest.z - stand.z) < 1e-6);
    // Start yaw −π/2: front (local −X) is world −Z; pan (local −Z) is world +X.
    assert.ok(plan.dest.z < state.furniture.range.z - 0.9, 'one step out from the front face');
    assert.ok(plan.dest.x > state.furniture.range.x + 0.2, 'lined up with the pan, not the chimney');
    const end = plan.path[plan.path.length - 1];
    assert.ok(Math.hypot(end.x - stand.x, end.z - stand.z) < 0.05, 'path ends on the stand');
    assert.equal(
      isWalkable(stand.x, stand.z, playerObstacles(state), PLAYER_RADIUS, playerWalkFloors([])),
      true,
    );
    assert.ok(Math.abs(rangeFaceYaw(state.furniture.range)) < 1e-9, 'face world +Z, into the range');

    const atChimney = resolveStationUse(
      { x: state.furniture.range.x - 0.85, z: state.furniture.range.z },
      state.furniture.range,
      state,
      undefined,
      'range',
    );
    assert.equal(atChimney.action, 'walk');
    assert.ok(atChimney.dest.z < state.furniture.range.z - 0.9);

    const already = resolveStationUse(stand, state.furniture.range, state, undefined, 'range');
    assert.equal(already.action, 'open');

    state.furniture.range = { x: SHOP.range.x, z: SHOP.range.z, rot: Math.PI / 2 };
    const turned = resolveStationUse(from, state.furniture.range, state, undefined, 'range');
    const turnedStand = rangeStandWorld(state.furniture.range);
    assert.equal(turned.action, 'walk');
    assert.ok(Math.hypot(turned.dest.x - turnedStand.x, turned.dest.z - turnedStand.z) < 1e-6);
    assert.ok(turned.dest.x < state.furniture.range.x - 0.9, 'front stays local −X after a quarter turn');
    assert.ok(turned.dest.z < state.furniture.range.z - 0.2, 'pan stays local −Z after a quarter turn');
    assert.equal(
      isWalkable(turnedStand.x, turnedStand.z, playerObstacles(state), PLAYER_RADIUS, playerWalkFloors([])),
      true,
    );
  });

  it('stands one step in front of the fletching bench vice, not at the left end', () => {
    const state = createState();
    const from = { x: SHOP.keeper.x, z: SHOP.keeper.z };
    state.furniture.fletch = { x: 0.2, z: 0.2, rot: 0 };
    const plan = resolveStationUse(from, state.furniture.fletch, state, undefined, 'fletch');
    const stand = fletchStandWorld(state.furniture.fletch);
    assert.equal(plan.action, 'walk');
    assert.ok(Math.hypot(plan.dest.x - stand.x, plan.dest.z - stand.z) < 1e-6);
    assert.ok(plan.dest.z > state.furniture.fletch.z + 0.9, 'one step out from the front face');
    assert.ok(plan.dest.x < state.furniture.fletch.x - 0.1, 'centre-left, under the vice');
    assert.ok(plan.dest.x > state.furniture.fletch.x - 0.5, 'not off the left end');
    const end = plan.path[plan.path.length - 1];
    assert.ok(Math.hypot(end.x - stand.x, end.z - stand.z) < 0.05, 'path ends on the stand');
    assert.equal(
      isWalkable(stand.x, stand.z, playerObstacles(state), PLAYER_RADIUS, playerWalkFloors([])),
      true,
    );
    assert.ok(Math.abs(Math.abs(fletchFaceYaw(state.furniture.fletch)) - Math.PI) < 1e-9);

    const atEnd = resolveStationUse(
      { x: state.furniture.fletch.x - 0.85, z: state.furniture.fletch.z },
      state.furniture.fletch,
      state,
      undefined,
      'fletch',
    );
    assert.equal(atEnd.action, 'walk');
    assert.ok(atEnd.dest.z > state.furniture.fletch.z + 0.9);

    const already = resolveStationUse(stand, state.furniture.fletch, state, undefined, 'fletch');
    assert.equal(already.action, 'open');

    state.furniture.fletch = { x: 0.2, z: 0.2, rot: -Math.PI / 2 };
    const turned = resolveStationUse(from, state.furniture.fletch, state, undefined, 'fletch');
    const turnedStand = fletchStandWorld(state.furniture.fletch);
    assert.equal(turned.action, 'walk');
    assert.ok(Math.hypot(turned.dest.x - turnedStand.x, turned.dest.z - turnedStand.z) < 1e-6);
    assert.ok(turned.dest.x < state.furniture.fletch.x - 0.9, 'front stays local +Z after a quarter turn');
    assert.ok(turned.dest.z < state.furniture.fletch.z - 0.1, 'vice stays local −X after a quarter turn');
    assert.equal(
      isWalkable(turnedStand.x, turnedStand.z, playerObstacles(state), PLAYER_RADIUS, playerWalkFloors([])),
      true,
    );
  });

  it('walks behind the counter to the shopkeeper side, not the buyer queue', () => {
    const state = createState();
    const plan = resolveStationUse(
      { x: 0, z: 1.4 },
      state.furniture.counter,
      state,
      undefined,
      'counter',
    );
    assert.equal(plan.action, 'walk');
    assert.ok(plan.dest.z < state.furniture.counter.z - 0.4, 'stand on the keeper side (−Z)');
    assert.ok(Math.abs(plan.dest.x - state.furniture.counter.x) < 0.5);
    const already = resolveStationUse(
      { x: SHOP.keeper.x, z: SHOP.keeper.z },
      state.furniture.counter,
      state,
      undefined,
      'counter',
    );
    assert.equal(already.action, 'open');
  });

  it('walks to the chest latch-front, not into the stone wall', () => {
    const state = createState();
    const chest = state.furniture.chest;
    const plan = resolveStationUse(
      { x: 0, z: 0 },
      chest,
      state,
      undefined,
      'chest',
    );
    assert.equal(plan.action, 'walk');
    assert.ok(plan.dest.x < chest.x - 0.4, 'stand in front of the latch, into the room');
    assert.ok(Math.abs(plan.dest.z - chest.z) < 0.35, 'not along the back wall');
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
