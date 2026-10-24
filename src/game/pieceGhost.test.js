import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONSTRUCTION_PIECES, constructionPiece, retiredRefund, readPlacedFurniture } from './construction.js';
import { ghostifyPieceVisual, visibleGhostMeshes } from './pieceGhost.js';
import { FIRE_LIGHT_REACH } from './animProps.js';

// Stand-in for a loaded GLB/OBJ: single-material meshes with no geometry groups, nested under a scaled root.
function fakeBundled(tint) {
  const root = new THREE.Group();
  root.scale.setScalar(0.01125);
  const inner = new THREE.Group();
  inner.add(new THREE.Mesh(new THREE.BoxGeometry(50, 50, 50), new THREE.MeshStandardMaterial({ color: tint })));
  inner.add(new THREE.SkinnedMesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshStandardMaterial({ color: tint })));
  root.add(inner);
  return root;
}

describe('construction placement ghost', () => {
  const outdoor = CONSTRUCTION_PIECES.filter((p) => p.mount === 'outdoor');
  it('has visible meshes for every outdoor catalogue entry', () => {
    assert.ok(outdoor.length > 10);
    for (const row of outdoor) {
      const ghost = ghostifyPieceVisual(fakeBundled(row.tint), row.tint);
      const shown = visibleGhostMeshes(ghost);
      assert.equal(shown.length, 2, row.id);
      for (const mesh of shown) {
        assert.equal(Array.isArray(mesh.material), false, row.id);
        assert.ok(mesh.material.transparent && mesh.material.opacity > 0.3, row.id);
      }
    }
  });
  it('keeps multi-material meshes as arrays', () => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.Mesh(geo, [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()]);
    ghostifyPieceVisual(mesh);
    assert.equal(mesh.material.length, 2);
    assert.equal(visibleGhostMeshes(mesh).length, 1);
  });
});

describe('Bush removed, campfire halved (Luke 2026-10-24)', () => {
  it('drops the standard Bush but refunds and skips old placed bushes', () => {
    assert.ok(!constructionPiece('bush'));
    assert.ok(constructionPiece('garden_bush'));
    assert.deepEqual(retiredRefund([{ id: 'bush', x: 0, z: 0 }]), { flax: 2 });
    assert.deepEqual(readPlacedFurniture([{ id: 'bush', x: 0, z: 0 }]), []);
  });
  it('halves the campfire and its light reach', () => {
    assert.equal(constructionPiece('fire').scale, 0.5);
    assert.equal(FIRE_LIGHT_REACH.fire, 0.5);
  });
});
