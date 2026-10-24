import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './canvas-mock.js';
import { buildDungeon, DUNGEON_BOULDERS, boulderVisualBox } from './shopbuild.js';
import { boulderAtFloor, boulderFaceRadius, pickUseHit } from './interact.js';

function picksAndRocks() {
  const { root } = buildDungeon();
  root.updateMatrixWorld(true);
  const picks = [];
  root.traverse((c) => { if (c.userData?.kind === 'boulder' && c.isMesh) picks.push(c); });
  return { root, picks };
}

describe('dungeon rock hit areas', () => {
  it('every rock pick hugs its visible model', () => {
    const { picks } = picksAndRocks();
    assert.equal(picks.length, DUNGEON_BOULDERS.length);
    for (const pick of picks) {
      const group = pick.parent;
      const vis = boulderVisualBox(group);
      assert.ok(!vis.isEmpty(), pick.userData.materialId);
      pick.geometry.computeBoundingBox();
      const pb = pick.geometry.boundingBox.clone().translate(pick.position);
      const tol = 0.02;
      assert.ok(pb.min.x >= vis.min.x - tol && pb.max.x <= vis.max.x + tol, `${pick.userData.materialId} x`);
      assert.ok(pb.min.z >= vis.min.z - tol && pb.max.z <= vis.max.z + tol, `${pick.userData.materialId} z`);
      assert.ok(pb.min.y >= vis.min.y - tol && pb.max.y <= vis.max.y + tol, `${pick.userData.materialId} y`);
    }
  });

  it('essence pick is far smaller than the old 2.7 m box', () => {
    const { picks } = picksAndRocks();
    const ess = picks.find((p) => p.userData.materialId === 'essence');
    ess.geometry.computeBoundingBox();
    const size = ess.geometry.boundingBox.getSize(new THREE.Vector3());
    assert.ok(size.x < 2.7 && size.z < 2.7);
  });

  it('closest rock under the cursor wins when picks overlap', () => {
    const { picks } = picksAndRocks();
    const near = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    near.userData = { kind: 'boulder', materialId: 'iron' };
    const far = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    far.userData = { kind: 'boulder', materialId: 'essence' };
    near.position.set(0, 0, 2); far.position.set(0, 0, 0);
    near.updateMatrixWorld(); far.updateMatrixWorld();
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, -1));
    const hits = ray.intersectObjects([far, near], false);
    assert.equal(pickUseHit(hits).object.userData.materialId, 'iron');
    assert.ok(picks.length > 0);
  });

  it('a ray just past each rock edge misses that rock', () => {
    const { root, picks } = picksAndRocks();
    for (const pick of picks) {
      const vis = boulderVisualBox(pick.parent);
      const w = new THREE.Vector3(vis.max.x + 0.15, (vis.min.y + vis.max.y) / 2, (vis.min.z + vis.max.z) / 2);
      pick.parent.localToWorld(w);
      const ray = new THREE.Raycaster(new THREE.Vector3(w.x, 30, w.z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(pick, false);
      assert.equal(hit.length, 0, pick.userData.materialId);
    }
    assert.ok(root);
  });

  it('floor fallback picks the nearest rock, not the first in the list', () => {
    const ess = DUNGEON_BOULDERS.find((b) => b.materialId === 'essence');
    const other = { id: 'iron', materialId: 'iron', x: ess.x + 1.3, z: ess.z };
    const got = boulderAtFloor(ess.x + 1.1, ess.z, [ess, other]);
    assert.equal(got.materialId, 'iron');
    assert.equal(boulderAtFloor(ess.x + boulderFaceRadius('essence') + 0.5, ess.z + 5, [ess]), null);
    assert.equal(boulderAtFloor(ess.x, ess.z, [ess, other]).materialId, 'essence');
  });
});
