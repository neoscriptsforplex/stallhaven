import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SHOP } from './catalog.js';
import {
  FLOOR,
  isWalkable,
  nearestWalkable,
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
});
