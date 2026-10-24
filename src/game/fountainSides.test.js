import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStationUse, fountainStands } from './interact.js';
import { FOUNTAIN } from './layout.js';

const straight = (from, to) => [{ x: to.x, z: to.z }];
const pose = { x: FOUNTAIN.x, z: FOUNTAIN.z };

describe('fountain four sides', () => {
  it('has four stands outside the bowl, facing it', () => {
    const st = fountainStands(pose);
    assert.equal(st.length, 4);
    for (const s of st) {
      assert.ok(Math.hypot(s.x - pose.x, s.z - pose.z) >= 1.69);
      const fx = Math.sin(s.yaw); const fz = Math.cos(s.yaw);
      assert.ok((pose.x - s.x) * fx + (pose.z - s.z) * fz > 1.6);
    }
  });
  it('walks to the nearest side from several starts', () => {
    const starts = [[0, -6], [0, 6], [6, 0], [-6, 0], [4, 5], [-5, -3]];
    for (const [dx, dz] of starts) {
      const from = { x: pose.x + dx, z: pose.z + dz };
      const plan = resolveStationUse(from, { ...pose, kind: 'fountain' }, {}, straight, 'fountain', () => true);
      assert.equal(plan.action, 'walk');
      const near = fountainStands(pose).sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z))[0];
      assert.deepEqual(plan.dest, near);
      assert.equal(plan.face, near.yaw);
    }
  });
  it('starts filling at each of the four sides', () => {
    for (const s of fountainStands(pose)) {
      const plan = resolveStationUse({ x: s.x, z: s.z }, { ...pose, kind: 'fountain' }, {}, straight, 'fountain', () => true);
      assert.equal(plan.action, 'open');
      assert.equal(plan.face, s.yaw);
    }
  });
});

import * as nav from './nav.js';
import { playerWalkFloors } from './layout.js';
describe('fountain sides in the real world', () => {
  it('every stand is walkable and reachable with the real planner', () => {
    const st = { expansions: [] };
    const obs = nav.playerObstacles(st);
    const fl = playerWalkFloors([]);
    for (const s of fountainStands(pose)) {
      assert.ok(nav.isWalkable(s.x, s.z, obs, nav.PLAYER_RADIUS, fl), `stand ${s.x},${s.z}`);
      for (const [dx, dz] of [[0, -5], [0, 5], [5, 0], [-5, 0]]) {
        const from = { x: pose.x + dx, z: pose.z + dz };
        const plan = resolveStationUse(from, { ...pose }, st, nav.planPlayerWalk, 'fountain', (x, z) => nav.isWalkable(x, z, obs, nav.PLAYER_RADIUS, fl));
        assert.ok(plan.action === 'walk' || plan.action === 'open', JSON.stringify(plan.action));
      }
    }
  });
});
