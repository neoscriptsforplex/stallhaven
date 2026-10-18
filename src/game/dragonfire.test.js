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

/** Sign of the thin-axis side the boss or snout sticks out on. +1 is +Z. */
function bossSign(pts) {
  const zs = pts.map((p) => p.z).sort((a, b) => a - b);
  const mid = zs[Math.floor(zs.length / 2)] ?? 0;
  let best = pts[0];
  let dist = -1;
  for (const p of pts) {
    const d = Math.abs(p.z - mid);
    if (d > dist) {
      dist = d;
      best = p;
    }
  }
  return Math.sign((best?.z ?? 0) - mid);
}

function assertUpright(view, label) {
  const size = new THREE.Box3().setFromPoints(worldPoints(view)).getSize(new THREE.Vector3());
  assert.ok(
    size.y > size.x && size.y > size.z,
    `${label} should stand up, y=${size.y} x=${size.x} z=${size.z}`,
  );
}

describe('dragonfire shield', () => {
  it('stands upright like the other kiteshields', async () => {
    const dragon = await loadShield('dragon_kiteshield');
    const bronze = await loadShield('bronze_kiteshield');
    const host = buildWare('dragon_kiteshield');
    const box = new THREE.Box3().setFromObject(host);
    const dragonEuler = bundledWareEuler('dragon_kiteshield', dragon, box);
    assert.deepEqual(dragonEuler, dumpStandEuler(dragon, box));
    assert.notEqual(dragonEuler.rotateZ, Math.PI);
    assert.deepEqual(
      bundledWareEuler('bronze_kiteshield', bronze, box),
      dumpStandEuler(bronze, box),
    );
    assert.notEqual(bundledWareEuler('runite_kiteshield', bronze, box).rotateZ, Math.PI);

    setBundledLook('dragon_kiteshield', dragon);
    setBundledLook('bronze_kiteshield', bronze);
    try {
      const views = [
        ['craft', buildWare('dragon_kiteshield')],
        ['preview', wrapCraftPreviewSpin(buildWare('dragon_kiteshield'), 'dragon_kiteshield')],
        ['table', mountDisplayBasePose(buildWare('dragon_kiteshield'), 'dragon_kiteshield')],
        ['mannequin', mountDisplayBasePose(buildWare('dragon_kiteshield'), 'dragon_kiteshield', { mannequin: true })],
      ];
      for (const [label, view] of views) assertUpright(view, label);
      const bronzePts = worldPoints(buildWare('bronze_kiteshield'));
      const dragonPts = worldPoints(buildWare('dragon_kiteshield'));
      const bronzeFace = bossSign(bronzePts);
      const dragonFace = bossSign(dragonPts);
      assert.notEqual(bronzeFace, 0);
      assert.equal(dragonFace, bronzeFace, 'dragonfire shield faces the same way as the bronze kiteshield');
      assert.equal(bossSign(worldPoints(wrapCraftPreviewSpin(buildWare('dragon_kiteshield'), 'dragon_kiteshield'))), bronzeFace);
      assert.equal(bossSign(worldPoints(mountDisplayBasePose(buildWare('dragon_kiteshield'), 'dragon_kiteshield'))), bronzeFace);
      const bronzeSize = new THREE.Box3().setFromPoints(bronzePts).getSize(new THREE.Vector3());
      assert.ok(bronzeSize.y > bronzeSize.x, 'bronze kiteshield stays upright');
      assert.ok(bronzeSize.y > bronzeSize.z, 'bronze kiteshield stays upright');
      assert.ok(bandWidth(bronzePts, 0, 0.18) < bandWidth(bronzePts, 0.45, 0.85));
    } finally {
      setBundledLook('dragon_kiteshield', null);
      setBundledLook('bronze_kiteshield', null);
    }
  });
});
