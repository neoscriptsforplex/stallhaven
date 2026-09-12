import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SHOP } from './catalog.js';
import { createState } from './economy.js';
import { gardenTrapdoorSpot } from './layout.js';
import {
  FLOOR,
  isWalkable,
  nearestWalkable,
  placementBlocked,
  planPlayerWalk,
  planWalk,
  queueSlot,
  shopObstacles,
} from './nav.js';

describe('shop navigation', () => {
  const obstacles = shopObstacles();

  it('lets the shopkeeper stand behind the counter', () => {
    assert.equal(isWalkable(SHOP.keeper.x, SHOP.keeper.z, obstacles), true);
    assert.equal(isWalkable(0, SHOP.counter.z - 0.82, obstacles), true);
  });

  it('blocks the counter, walls, and the road outside', () => {
    assert.equal(isWalkable(SHOP.counter.x, SHOP.counter.z, obstacles), false);
    assert.equal(isWalkable(0, FLOOR.maxZ + 0.6, obstacles), false);
    assert.equal(isWalkable(FLOOR.minX - 0.4, 0, obstacles), false);
  });

  it('walks around the counter instead of through it', () => {
    const from = { x: 0, z: 1.2 };
    const to = { x: 0, z: SHOP.counter.z - 0.82 };
    const path = planWalk(from, to, obstacles);
    assert.ok(path.length >= 1);
    for (const point of path) {
      assert.equal(isWalkable(point.x, point.z, obstacles), true);
    }
    const through = path.some((point) => (
      Math.abs(point.z - SHOP.counter.z) < 0.18 && Math.abs(point.x) < 0.7
    ));
    assert.equal(through, false);
  });

  it('snaps a click on the counter to nearby walkable floor', () => {
    const snapped = nearestWalkable(SHOP.counter.x, SHOP.counter.z, obstacles);
    assert.ok(snapped);
    assert.equal(isWalkable(snapped.x, snapped.z, obstacles), true);
  });

  it('places queue slots on walkable floor in front of the counter', () => {
    for (let i = 0; i < 3; i += 1) {
      const slot = queueSlot(i);
      assert.equal(isWalkable(slot.x, slot.z, obstacles), true);
      assert.ok(slot.z > SHOP.counter.z);
    }
  });

  it('leaves the back corners behind the anvil and chest unblocked', () => {
    assert.equal((SHOP.clutter ?? []).length, 0);
    const behindAnvil = nearestWalkable(-3.4, -2.95, obstacles);
    const behindChest = nearestWalkable(3.4, -2.95, obstacles);
    assert.ok(behindAnvil);
    assert.ok(behindChest);
    assert.equal(isWalkable(behindAnvil.x, behindAnvil.z, obstacles), true);
    assert.equal(isWalkable(behindChest.x, behindChest.z, obstacles), true);
  });

  it('refuses a placement that overlaps another obstacle', () => {
    const floors = [FLOOR];
    const blocks = [{ minX: -1, maxX: 1, minZ: -2.2, maxZ: -1.2 }];
    const overlap = placementBlocked({ x: 0, z: -1.7, rot: 0 }, 'chest', blocks, floors, { checkAisle: false });
    assert.equal(overlap, 'That spot overlaps other furniture.');
    const clear = placementBlocked({ x: -2.2, z: 0.4, rot: 0 }, 'table', [], floors, { checkAisle: false });
    assert.equal(clear, null);
  });

  it('walks from behind the counter onto the outdoor path and to the trapdoor', () => {
    const state = createState();
    const path = planPlayerWalk(
      { x: SHOP.keeper.x, z: SHOP.keeper.z },
      { x: 0, z: 6.2 },
      state,
    );
    assert.ok(path.length >= 1, 'should path onto the front grass');
    assert.ok(path.some((point) => point.z > FLOOR.maxZ + 0.4));
    const hatch = gardenTrapdoorSpot([]);
    assert.ok(hatch);
    const hatchPath = planPlayerWalk(
      { x: SHOP.keeper.x, z: SHOP.keeper.z },
      { x: hatch.x, z: hatch.z },
      state,
    );
    assert.ok(hatchPath.length >= 1, 'should path to the outdoor trapdoor');
    const end = hatchPath[hatchPath.length - 1];
    assert.ok(Math.hypot(end.x - hatch.x, end.z - hatch.z) < 1.2);
  });

  it('walks from the main shop onto side and rear expansion floors', () => {
    const right = createState();
    right.expansions = ['right'];
    const rightPath = planPlayerWalk(
      { x: SHOP.keeper.x, z: SHOP.keeper.z },
      { x: 8.2, z: 0.1 },
      right,
    );
    assert.ok(rightPath.length >= 1, 'should path into the right expansion');
    const endRight = rightPath[rightPath.length - 1];
    assert.ok(endRight.x > 5, 'should finish inside the side room');

    const back = createState();
    back.expansions = ['back'];
    const backPath = planPlayerWalk(
      { x: SHOP.keeper.x, z: SHOP.keeper.z },
      { x: 0, z: -7 },
      back,
    );
    assert.ok(backPath.length >= 1, 'should path into the rear expansion');
    const endBack = backPath[backPath.length - 1];
    assert.ok(endBack.z < -4, 'should finish inside the rear room');
  });
});
