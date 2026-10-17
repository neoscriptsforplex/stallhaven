import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import './canvas-mock.js';
import * as THREE from 'three';
import { mountDisplayBasePose, wrapCraftPreviewSpin } from './craftpreview.js';
import {
  buildWare,
  bundledWareEuler,
  dumpStandEuler,
  setBundledLook,
} from './models.js';
import { parseModelBuffer } from './upload.js';

const modelsRoot = join(dirname(fileURLToPath(import.meta.url)), '../../public/models');

async function loadShield(id) {
  const folder = `gear/${id.replaceAll('_', '-')}`;
  const base = folder.split('/').pop();
  const obj = readFileSync(join(modelsRoot, folder, `${base}.obj`));
  const mtl = readFileSync(join(modelsRoot, folder, `${base}.mtl`));
  return parseModelBuffer(
    obj.buffer.slice(obj.byteOffset, obj.byteOffset + obj.byteLength),
    `${base}.obj`,
    { [`${base}.mtl`]: mtl.buffer.slice(mtl.byteOffset, mtl.byteOffset + mtl.byteLength) },
  );
}

function worldPoints(root) {
  const pts = [];
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (!child.isMesh) return;
    const pos = child.geometry.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i);
      child.localToWorld(v);
      pts.push(v.clone());
    }
  });
  return pts;
}

/** Width of the silhouette between two fractions of the model's height. */
function bandWidth(pts, from, to) {
  const ys = pts.map((p) => p.y);
  const minY = Math.min(...ys);
  const span = Math.max(...ys) - minY || 1;
  const band = pts.filter((p) => {
    const t = (p.y - minY) / span;
    return t >= from && t < to;
  });
  assert.ok(band.length > 0, `empty band ${from}-${to}`);
  const xs = band.map((p) => p.x);
  return Math.max(...xs) - Math.min(...xs);
}

describe('dragonfire shield', () => {
  it('rotates only the dragonfire shield a half-turn so the kite point is down', async () => {
    const dragon = await loadShield('dragon_kiteshield');
    const bronze = await loadShield('bronze_kiteshield');
    const host = buildWare('dragon_kiteshield');
    const box = new THREE.Box3().setFromObject(host);
    assert.deepEqual(bundledWareEuler('dragon_kiteshield', dragon, box), {
      rotateX: 0,
      rotateY: 0,
      rotateZ: Math.PI,
    });
    assert.deepEqual(
      bundledWareEuler('bronze_kiteshield', bronze, box),
      dumpStandEuler(bronze, box),
    );
    assert.notEqual(bundledWareEuler('runite_kiteshield', bronze, box).rotateZ, Math.PI);

    setBundledLook('dragon_kiteshield', dragon);
    setBundledLook('bronze_kiteshield', bronze);
    try {
      for (const view of [
        buildWare('dragon_kiteshield'),
        wrapCraftPreviewSpin(buildWare('dragon_kiteshield'), 'dragon_kiteshield'),
        mountDisplayBasePose(buildWare('dragon_kiteshield'), 'dragon_kiteshield'),
        mountDisplayBasePose(buildWare('dragon_kiteshield'), 'dragon_kiteshield', { mannequin: true }),
      ]) {
        const pts = worldPoints(view);
        const tip = bandWidth(pts, 0, 0.12);
        const top = bandWidth(pts, 0.82, 1.01);
        assert.ok(tip < top * 0.25, `point width ${tip} vs top ${top}`);
      }
      const bronzePts = worldPoints(buildWare('bronze_kiteshield'));
      const bronzeSize = new THREE.Box3().setFromPoints(bronzePts).getSize(new THREE.Vector3());
      assert.ok(bronzeSize.y > bronzeSize.x, 'bronze kiteshield stays upright');
      assert.ok(bandWidth(bronzePts, 0, 0.18) < bandWidth(bronzePts, 0.45, 0.85));
    } finally {
      setBundledLook('dragon_kiteshield', null);
      setBundledLook('bronze_kiteshield', null);
    }
  });
});
