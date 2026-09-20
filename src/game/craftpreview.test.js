import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import './canvas-mock.js';
import * as THREE from 'three';
import { frameCraftPreview, isRunePreview } from './craftpreview.js';
import { buildWare } from './models.js';

describe('craft preview framing', () => {
  it('centers the camera on the item instead of looking at the handle', () => {
    for (const id of ['bronze_hatchet', 'bronze_pickaxe', 'bronze_sword']) {
      const camera = new THREE.PerspectiveCamera(38, 1.15, 0.05, 20);
      camera.position.set(0.62, 0.48, 0.92);
      camera.lookAt(0, 0.18, 0);
      const ware = buildWare(id);
      const box = new THREE.Box3().setFromObject(ware);
      const center = box.getCenter(new THREE.Vector3());
      const framed = frameCraftPreview(ware, camera);
      assert.ok(framed, id);
      assert.ok(Math.abs(framed.center.y - center.y) < 0.03, `${id} frame center`);
      assert.ok(framed.dist > framed.radius * 1.3, `${id} should pull the camera back`);
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const aim = camera.position.clone().addScaledVector(dir, framed.dist);
      assert.ok(Math.abs(aim.y - center.y) < framed.radius * 0.25, `${id} should aim at the item center`);
    }
  });

  it('frames runes from the front so the glyph face is visible', () => {
    assert.equal(isRunePreview('air_rune'), true);
    assert.equal(isRunePreview('bronze_sword'), false);
    const camera = new THREE.PerspectiveCamera(38, 1.15, 0.05, 20);
    const ware = buildWare('air_rune');
    ware.rotation.x = -Math.PI / 2;
    ware.updateMatrixWorld(true);
    const framed = frameCraftPreview(ware, camera, 1.42, null, { view: 'front' });
    assert.ok(framed);
    assert.equal(framed.view, 'front');
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    assert.ok(Math.abs(dir.z) > Math.abs(dir.y), 'rune camera should look forward at the face, not down');
    assert.ok(Math.abs(camera.position.y - framed.center.y) < framed.radius * 0.35);
    const sword = buildWare('bronze_sword');
    const other = new THREE.PerspectiveCamera(38, 1.15, 0.05, 20);
    frameCraftPreview(sword, other);
    assert.ok(other.position.x > other.position.y * 0.5, 'non-rune preview keeps the three-quarter camera');
  });
});
