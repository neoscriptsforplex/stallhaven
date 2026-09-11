import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RAT_BOUNDS, initRatWander, randomRatGoal, stepRatWander } from './rats.js';

function fakeRat(x = 0, z = 0) {
  return {
    position: { x, y: 0.06, z },
    rotation: { y: 0 },
    userData: {},
  };
}

describe('dungeon rats', () => {
  it('picks wander goals on the dungeon floor', () => {
    const goal = randomRatGoal(() => 0.5);
    assert.ok(goal.x > RAT_BOUNDS.minX);
    assert.ok(goal.x < RAT_BOUNDS.maxX);
    assert.ok(goal.z > RAT_BOUNDS.minZ);
    assert.ok(goal.z < RAT_BOUNDS.maxZ);
  });

  it('walks toward a goal instead of only spinning', () => {
    const rat = fakeRat(0, 0);
    initRatWander(rat, 0, () => 1);
    rat.userData.wander.wait = 0;
    rat.userData.wander.tx = 2;
    rat.userData.wander.tz = 0;
    const startX = rat.position.x;
    const startRot = rat.rotation.y;
    stepRatWander(rat, 0.2, 1, () => 0.2);
    assert.ok(rat.position.x > startX, 'rat should move toward +X');
    assert.notEqual(rat.rotation.y, startRot);
    assert.ok(Math.abs(rat.position.z) < 0.2);
  });
});
