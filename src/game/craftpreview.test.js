import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import './canvas-mock.js';
import * as THREE from 'three';
import { craftPreviewEuler, frameCraftPreview, isRunePreview, poseRuneForFrontView } from './craftpreview.js';
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
    poseRuneForFrontView(ware);
    const glyph = new THREE.Vector3(0, 1, 0).applyQuaternion(ware.quaternion);
    assert.ok(glyph.z > 0.85, `glyph +Y should face the +Z camera, z=${glyph.z}`);
    const framed = frameCraftPreview(ware, camera, 1.42, null, { view: 'front' });
    assert.ok(framed);
    assert.equal(framed.view, 'front');
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    assert.ok(dir.z < -0.9, 'rune camera should look along -Z at the glyph, not down');
    assert.ok(Math.abs(dir.y) < 0.15, 'rune camera should not be elevated');
    assert.ok(Math.abs(camera.position.y - framed.center.y) < framed.radius * 0.35);
    poseRuneForFrontView(ware, 1.2);
    const spun = new THREE.Vector3(0, 1, 0).applyQuaternion(ware.quaternion);
    assert.ok(spun.z > 0.85, 'in-plane spin must keep the glyph facing the camera');
    const sword = buildWare('bronze_sword');
    const other = new THREE.PerspectiveCamera(38, 1.15, 0.05, 20);
    frameCraftPreview(sword, other);
    assert.ok(other.position.x > other.position.y * 0.5, 'non-rune preview keeps the three-quarter camera');
  });

  it('frames craft-screen ore dumps with the default three-quarter camera', () => {
    const camera = new THREE.PerspectiveCamera(38, 1.15, 0.05, 20);
    const ware = buildWare('bronze');
    const framed = frameCraftPreview(ware, camera);
    assert.ok(framed);
    assert.equal(framed.view, 'default');
    assert.ok(camera.position.x > camera.position.y * 0.5, 'ore preview keeps the three-quarter camera');
    assert.equal(isRunePreview('bronze'), false);
  });

  it('applies a preview-only flip by armour family and leaves the ware mesh alone', () => {
    assert.equal(craftPreviewEuler('mystic_robe_bottom').z, -Math.PI / 4);
    assert.equal(craftPreviewEuler('splitbark_robe_bottom').z, -Math.PI / 4);
    assert.equal(craftPreviewEuler('bronze_platelegs').x, Math.PI);
    assert.equal(craftPreviewEuler('dragon_platelegs').x, Math.PI);
    assert.equal(craftPreviewEuler('blue_dhide_chaps').x, Math.PI);
    assert.equal(craftPreviewEuler('black_dhide_chaps').x, Math.PI);
    assert.equal(craftPreviewEuler('bronze_platebody').y, Math.PI / 2);
    assert.equal(craftPreviewEuler('runite_platebody').y, Math.PI / 2);
    assert.equal(craftPreviewEuler('bronze_platebody').x, 0);
    assert.equal(craftPreviewEuler('wizard_robe'), null);
    assert.equal(craftPreviewEuler('mystic_robe_top'), null);
    assert.equal(craftPreviewEuler('splitbark_robe_top'), null);
    assert.equal(craftPreviewEuler('bronze_plateskirt').x, Math.PI / 2);
    assert.equal(craftPreviewEuler('dragon_plateskirt').x, Math.PI / 2);
    assert.equal(craftPreviewEuler('green_dragon_mask'), null);
    assert.equal(craftPreviewEuler('black_dragon_mask'), null);
    assert.equal(craftPreviewEuler('blue_dragon_mask'), null);
    assert.equal(craftPreviewEuler('bronze_sword'), null);
    const ware = buildWare('bronze_platelegs');
    assert.equal(ware.rotation.x, 0);
    assert.equal(ware.rotation.y, 0);
    assert.equal(ware.rotation.z, 0);
  });
});
