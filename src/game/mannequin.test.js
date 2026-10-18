import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import './canvas-mock.js';
import * as THREE from 'three';
import { RECIPES } from './catalog.js';
import { mountDisplayBasePose, wrapCraftPreviewSpin } from './craftpreview.js';
import { LUKE_MODEL_FOLDERS } from './gearlooks.js';
import {
  MANNEQUIN_WEAR_LIMITS,
  buildWare,
  fitMannequinWear,
  setBundledLook,
} from './models.js';
import { parseModelBuffer } from './upload.js';

const MODELS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../public/models');
const BODY_SHAPES = new Set(['platebody', 'chainbody', 'robe_top', 'dhide_body']);
const LEG_SHAPES = new Set(['platelegs', 'plateskirt', 'robe_bottom', 'dhide_chaps']);

/** Wood sizes the stand is built from. Margin is added on width and depth. */
const BLOCKS = {
  hips: { x: 0.34, y: 0.06, z: 0.14, at: 0.5 },
  shoulders: { x: 0.5, y: 0.06, z: 0.12, at: 1.16 },
};

function covers(outer, inner, eps = 1e-3) {
  return outer.min.x <= inner.min.x + eps
    && outer.min.y <= inner.min.y + eps
    && outer.min.z <= inner.min.z + eps
    && outer.max.x >= inner.max.x - eps
    && outer.max.y >= inner.max.y - eps
    && outer.max.z >= inner.max.z - eps;
}

function bodyTarget() {
  const { margin } = MANNEQUIN_WEAR_LIMITS;
  const depth = BLOCKS.shoulders.z;
  const y0 = BLOCKS.hips.at + BLOCKS.hips.y / 2;
  const y1 = BLOCKS.shoulders.at + BLOCKS.shoulders.y / 2;
  const hx = (BLOCKS.shoulders.x + margin) / 2;
  const hz = (depth + margin) / 2;
  return new THREE.Box3(new THREE.Vector3(-hx, y0, -hz), new THREE.Vector3(hx, y1, hz));
}

function legsTarget() {
  const { margin } = MANNEQUIN_WEAR_LIMITS;
  const hips = BLOCKS.hips;
  const hx = (hips.x + margin) / 2;
  const hy = hips.y / 2;
  const hz = (hips.z + margin) / 2;
  return new THREE.Box3(
    new THREE.Vector3(-hx, hips.at - hy, -hz),
    new THREE.Vector3(hx, hips.at + hy, hz),
  );
}

async function loadFolder(folder) {
  const base = folder.split('/').pop();
  const obj = readFileSync(join(MODELS_ROOT, folder, `${base}.obj`));
  const mtl = readFileSync(join(MODELS_ROOT, folder, `${base}.mtl`));
  return parseModelBuffer(
    obj.buffer.slice(obj.byteOffset, obj.byteOffset + obj.byteLength),
    `${folder}/${base}.obj`,
    { [`${base}.mtl`]: mtl.buffer.slice(mtl.byteOffset, mtl.byteOffset + mtl.byteLength) },
  );
}

function sideCounts(root) {
  const pts = [];
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (!child.isMesh || !child.geometry?.getAttribute?.('position')) return;
    const pos = child.geometry.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i);
      child.localToWorld(v);
      pts.push(v.z);
    }
  });
  const sorted = [...pts].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)] ?? 0;
  let front = 0;
  let back = 0;
  for (const z of pts) {
    if (z >= mid) front += 1;
    else back += 1;
  }
  return { front, back };
}

describe('mannequin body and leg fit', () => {
  it('keeps the scale clamp sane and leaves other displays at mount scale', () => {
    assert.equal(MANNEQUIN_WEAR_LIMITS.scaleMin, 0.5);
    assert.equal(MANNEQUIN_WEAR_LIMITS.scaleMax, 3);
    assert.equal(MANNEQUIN_WEAR_LIMITS.margin, 0.02);

    const ware = buildWare('bronze_platebody');
    const table = mountDisplayBasePose(ware, 'bronze_platebody');
    assert.equal(table.scale.x, 1);
    assert.equal(table.scale.y, 1);
    assert.equal(table.scale.z, 1);
    const pose = table.getObjectByName('preview-base-pose');
    assert.equal(pose.rotation.x, Math.PI / 2);
    assert.equal(pose.rotation.z, -Math.PI / 2);

    const preview = buildWare('wizard_robe');
    assert.equal(preview.scale.x, 1);
    assert.equal(fitMannequinWear(new THREE.Group(), 'mystic_gloves'), false);
    assert.equal(fitMannequinWear(new THREE.Group(), 'bronze_boots'), false);
    assert.equal(fitMannequinWear(buildWare('bronze_full_helm'), 'bronze_full_helm'), false);
    const boots = buildWare('bronze_boots');
    assert.equal(fitMannequinWear(boots, 'bronze_boots'), false);
    assert.equal(boots.scale.x, 1);
    assert.equal(boots.scale.y, 1);
    assert.equal(boots.scale.z, 1);
  });

  it('does not stretch a paper-thin body out to the wood depth', () => {
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.004));
    assert.equal(fitMannequinWear(sheet, 'bronze_platebody'), true);
    for (const axis of ['x', 'y', 'z']) {
      assert.ok(sheet.scale[axis] >= 0.5 && sheet.scale[axis] <= 3, axis);
    }
    assert.ok(Math.abs(sheet.scale.z - sheet.scale.x) < 1e-6);
    assert.ok(Math.abs(sheet.scale.z - sheet.scale.y) < 1e-6);
    assert.ok(sheet.scale.z < 5, `depth scale ${sheet.scale.z} should stay with the uniform scale`);

    const edgeOn = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.5, 0.42));
    assert.equal(fitMannequinWear(edgeOn, 'dragon_chainbody'), true);
    for (const axis of ['x', 'y', 'z']) {
      assert.ok(edgeOn.scale[axis] <= 3, `${axis} ${edgeOn.scale[axis]}`);
    }
    assert.ok(Math.max(edgeOn.scale.x, edgeOn.scale.y, edgeOn.scale.z) < 5);
  });

  it('covers the wooden blocks for every modelled body and leg piece', async () => {
    const byId = Object.fromEntries(LUKE_MODEL_FOLDERS.map((item) => [item.id, item.folder]));
    const ids = Object.values(RECIPES)
      .filter((recipe) => (BODY_SHAPES.has(recipe.shape) || LEG_SHAPES.has(recipe.shape)) && byId[recipe.id])
      .map((recipe) => recipe.id);
    assert.ok(ids.length >= 30, `expected the worn model set, got ${ids.length}`);
    assert.ok(ids.includes('dragon_chainbody'));
    assert.ok(ids.includes('bronze_platebody'));
    assert.equal(byId.dragon_platebody, undefined);

    const bodyWood = bodyTarget();
    const legsWood = legsTarget();
    for (const id of ids) {
      setBundledLook(id, await loadFolder(byId[id]));
      try {
        const mounted = mountDisplayBasePose(buildWare(id), id, { mannequin: true });
        assert.equal(mounted.scale.x, 1, `${id} mount scale`);
        if (id === 'dragon_chainbody' || id === 'bronze_chainbody') {
          const face = new THREE.Box3().setFromObject(mounted).getSize(new THREE.Vector3());
          assert.ok(face.z < face.x && face.z < face.y, `${id} faces front before the mannequin fit (${face.x}, ${face.y}, ${face.z})`);
        }
        assert.equal(fitMannequinWear(mounted, id), true, id);
        for (const axis of ['x', 'y', 'z']) {
          const value = mounted.scale[axis];
          assert.ok(value >= MANNEQUIN_WEAR_LIMITS.scaleMin, `${id} ${axis} ${value} below clamp`);
          assert.ok(value <= MANNEQUIN_WEAR_LIMITS.scaleMax, `${id} ${axis} ${value} above clamp`);
        }
        mounted.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mounted);
        const section = LEG_SHAPES.has(RECIPES[id].shape) ? 'legs' : 'body';
        const wood = section === 'legs' ? legsWood : bodyWood;
        assert.ok(covers(box, wood), `${id} box ${box.min.toArray()} ${box.max.toArray()} misses ${section}`);
        const center = box.getCenter(new THREE.Vector3());
        assert.ok(Math.abs(center.x) < 1e-3, `${id} center x ${center.x}`);
        assert.ok(Math.abs(center.z) < 1e-3, `${id} center z ${center.z}`);
      } finally {
        setBundledLook(id, null);
      }
    }
  });

  it('faces every chainbody, including dragon, toward +Z on the mannequin and the preview', async () => {
    const ids = ['bronze_chainbody', 'runite_chainbody', 'dragon_chainbody'];
    for (const id of ids) {
      setBundledLook(id, await loadFolder(`gear/${id.replaceAll('_', '-')}`));
      try {
        const ware = buildWare(id);
        const wareSize = new THREE.Box3().setFromObject(ware).getSize(new THREE.Vector3());
        assert.ok(wareSize.z < wareSize.x && wareSize.z < wareSize.y, `${id} ware faces front`);
        const preview = wrapCraftPreviewSpin(buildWare(id), id);
        const previewSize = new THREE.Box3().setFromObject(preview).getSize(new THREE.Vector3());
        assert.ok(previewSize.z < previewSize.x && previewSize.z < previewSize.y, `${id} preview faces front`);
        const mounted = mountDisplayBasePose(buildWare(id), id, { mannequin: true });
        assert.equal(fitMannequinWear(mounted, id), true, id);
        const { front, back } = sideCounts(mounted);
        assert.ok(front > back, `${id} chain should face +Z (front ${front}, back ${back})`);
      } finally {
        setBundledLook(id, null);
      }
    }
  });
});
