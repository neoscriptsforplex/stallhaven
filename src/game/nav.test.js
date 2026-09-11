import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SHOP } from './catalog.js';
import {
  FLOOR,
  isWalkable,
  nearestWalkable,
  placementBlocked,
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
});
