import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushOutPoint, isWalkable, moveWithCollision, rectFromCenter, buildShopWallRects, PLAYER_RADIUS, WALK_COLLIDE_RADIUS, FLOOR } from './nav.js';

const floors = [FLOOR];
const walls = buildShopWallRects([]);

test('wall shelf placed on a player against the wall frees them, and they can walk after', () => {
  const p = { x: 0.5, z: FLOOR.minZ + 0.3 };
  const shelf = rectFromCenter(0.5, FLOOR.minZ + 0.25, 1.0, 0.5);
  const obs = [...walls, shelf];
  assert.equal(isWalkable(p.x, p.z, obs, WALK_COLLIDE_RADIUS, floors), false);
  const spot = pushOutPoint(p.x, p.z, obs, floors, walls);
  assert.ok(spot);
  assert.ok(isWalkable(spot.x, spot.z, obs, PLAYER_RADIUS, floors));
  assert.ok(spot.z > FLOOR.minZ, 'stays inside the shop');
  const m = moveWithCollision(spot.x, spot.z, spot.x, spot.z + 0.3, obs, WALK_COLLIDE_RADIUS, floors);
  assert.ok(m.z > spot.z + 0.2, 'can walk away');
});

test('placing in the open pushes the player to the nearest free side', () => {
  const block = rectFromCenter(0.1, 0, 1.0, 1.0); // player at 0,0; nearest edge is -X
  const spot = pushOutPoint(0, 0, [block], floors, []);
  assert.ok(spot);
  assert.ok(spot.x < -0.6 && Math.abs(spot.z) < 0.25, `went ${JSON.stringify(spot)}`);
});

test('free player is left alone', () => {
  assert.equal(pushOutPoint(0, 0, [], floors, []), null);
});
