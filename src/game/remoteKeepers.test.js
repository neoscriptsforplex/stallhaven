import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRemoteKeepers } from './remoteKeepers.js';

function setup() {
  const calls = [];
  const scene = new THREE.Group();
  const keepers = createRemoteKeepers({
    scene,
    buildMesh: () => {
      const g = new THREE.Group();
      g.userData.clipLocomotion = { fake: true };
      return g;
    },
    planWalk: (from, to) => [to],
    walkToward: (actor, goal) => {
      calls.push('walk');
      actor.mesh.position.set(goal.x, 0, goal.z);
      return true;
    },
    idle: () => calls.push('idle'),
    setGather: (actor, mode) => calls.push(`set:${mode}`),
    gather: () => calls.push('gather'),
  });
  return { calls, scene, keepers };
}

test('remote keepers use the model the game builds and play gather clips', () => {
  const { calls, scene, keepers } = setup();
  keepers.api.add({ id: 'p1', name: 'Sam', color: 'blue' });
  assert.equal(scene.children.length, 1);
  assert.equal(keepers.api.list()[0].model, 'rigged');
  keepers.api.setActivity('p1', 'mine', 0.5);
  keepers.tick(0.016, 0, 'shop');
  assert.deepEqual(calls, ['set:mine', 'gather']);
  assert.equal(scene.children[0].rotation.y, 0.5);
  calls.length = 0;
  keepers.api.moveTo('p1', 1, 2);
  keepers.tick(0.016, 0, 'shop');
  keepers.tick(0.016, 0, 'shop');
  assert.deepEqual(calls, ['set:null', 'walk', 'idle']);
  assert.equal(keepers.api.list()[0].activity, null);
});

test('a late joiner sees a player who is already gathering', () => {
  const { calls, keepers } = setup();
  keepers.api.add({ id: 'p2', name: 'Ana', color: 'green', act: { mode: 'chop', yaw: 1 } });
  assert.deepEqual(calls, ['set:chop']);
  assert.equal(keepers.api.list()[0].activity, 'chop');
});

test('rebuildAll swaps in the new model and keeps place and activity', () => {
  const { calls, scene, keepers } = setup();
  keepers.api.add({ id: 'p1', name: 'Sam', color: 'blue', pos: { x: 2, z: 3, scene: 'shop' } });
  keepers.api.setActivity('p1', 'pick', 0.2);
  const before = scene.children[0];
  calls.length = 0;
  keepers.api.rebuildAll();
  assert.equal(scene.children.length, 1);
  assert.notEqual(scene.children[0], before);
  assert.equal(scene.children[0].position.x, 2);
  assert.equal(keepers.api.list()[0].activity, 'pick');
  assert.deepEqual(calls, ['set:pick']);
});
