import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import './canvas-mock.js';
import * as THREE from 'three';
import { RECIPES, stationForRecipe } from './catalog.js';
import { setBundledLook } from './models.js';
import { buildFurnace, buildLoom, buildPotterWheel, buildRange } from './shopbuild.js';
import { parseModelBuffer } from './upload.js';

const modelsRoot = join(dirname(fileURLToPath(import.meta.url)), '../../public/models');
const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
async function withLook(id, fn) {
  const dir = join(modelsRoot, id);
  const look = await parseModelBuffer(ab(readFileSync(join(dir, `${id}.obj`))), `${id}.obj`, { [`${id}.mtl`]: ab(readFileSync(join(dir, `${id}.mtl`))) });
  setBundledLook(id, look);
  try { return await fn(look); } finally { setBundledLook(id, null); }
}
const worldVerts = (o) => {
  let top = o; while (top.parent) top = top.parent;
  top.updateMatrixWorld(true); const out = []; const v = new THREE.Vector3();
  o.traverse((m) => { if (!m.isMesh || m.isInstancedMesh) return; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) out.push(v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).clone()); });
  return out;
};
const run = (fx, frames) => { for (let i = 0; i < frames; i++) fx.update(1 / 60); };
const visibleUnder = (o) => { let n = 0; o.traverse((m) => { if (m.isMesh) { let v = true; for (let p = m; p; p = p.parent) v &&= p.visible; if (v) n++; } }); return n; };

describe('station crafting animations', () => {
  it('maps every crafting category to the station that animates', () => {
    const stations = new Set(Object.values(RECIPES).map((r) => stationForRecipe(r)));
    for (const s of ['potter', 'furnace', 'range', 'loom']) assert.ok(stations.has(s), s);
  });

  it('spins the pottery wheel head on its vertical axle only while active', async () => {
    await withLook('potter', async (look) => {
      assert.ok(look.getObjectByName('pottery_plate'));
      const raw = new THREE.Box3().setFromObject(look).getSize(new THREE.Vector3());
      assert.ok(
        raw.y >= Math.max(raw.x, raw.z) * 0.82,
        `pottery wheel would be laid on its side (${raw.x.toFixed(1)}×${raw.y.toFixed(1)}×${raw.z.toFixed(1)})`,
      );
      const root = buildPotterWheel();
      const spin = root.userData.spinner;
      assert.ok(spin);
      let body = null;
      root.traverse((m) => { if (m.isMesh && m.name === 'potter') body = m; });
      const before = worldVerts(body);
      run(spin, 30);
      assert.equal(spin.angle(), 0);
      spin.setActive(true);
      run(spin, 60);
      assert.ok(Math.abs(spin.angle()) > 1);
      const ax = spin.axis.clone().transformDirection(spin.pivot.parent.matrixWorld);
      assert.ok(Math.abs(ax.y) > 0.999);
      worldVerts(body).forEach((v, i) => assert.ok(v.distanceTo(before[i]) < 1e-9));
      spin.setActive(false);
      run(spin, 30);
      const a = spin.angle(); run(spin, 10);
      assert.equal(spin.angle(), a);
    });
  });

  it('slides tinted bars into the furnace and hides them when smelting stops', async () => {
    await withLook('furnace', async () => {
      const root = buildFurnace();
      const fx = root.userData.furnaceFx;
      assert.ok(fx);
      run(fx, 10);
      assert.equal(fx.bars.visible, false);
      fx.setActive(true, RECIPES.smelt_adamant.tint);
      run(fx, 60);
      assert.equal(fx.bars.visible, true);
      assert.equal(fx.bars.children[0].material.color.getHex(), new THREE.Color(RECIPES.smelt_adamant.tint).getHex());
      assert.ok(fx.hotMaterials.length > 0);
      fx.setActive(false);
      run(fx, 60);
      assert.equal(fx.bars.visible, false);
      assert.equal(fx.light ? fx.light.intensity : 0, 0);
    });
  });

  it('shows stew, food and steam in the range pot only while cooking', async () => {
    await withLook('range', async () => {
      const root = buildRange();
      const fx = root.userData.rangeFx;
      assert.ok(fx);
      run(fx, 10);
      assert.equal(visibleUnder(fx.group), 0);
      fx.setActive(true);
      run(fx, 120);
      assert.ok(visibleUnder(fx.group) >= 3);
      fx.setActive(false);
      run(fx, 300);
      assert.equal(visibleUnder(fx.group), 0);
    });
  });

  it('animates the loom parts while weaving and returns them to rest', async () => {
    await withLook('loom', async () => {
      const root = buildLoom();
      const fx = root.userData.loomFx;
      assert.ok(fx);
      assert.deepEqual(Object.keys(fx.parts).sort(), ['loom_beater', 'loom_cloth_roll', 'loom_heddle_a', 'loom_heddle_b', 'loom_shuttle']);
      const shuttle = fx.parts.loom_shuttle;
      const rest = worldVerts(shuttle.part);
      fx.setActive(true);
      run(fx, 50);
      assert.ok(worldVerts(shuttle.part).some((v, i) => v.distanceTo(rest[i]) > 1e-3));
      fx.setActive(false);
      run(fx, 60);
      worldVerts(shuttle.part).forEach((v, i) => assert.ok(v.distanceTo(rest[i]) < 1e-9));
      for (const n of ['loom_beater', 'loom_heddle_a', 'loom_heddle_b']) {
        const p = fx.parts[n].pivot;
        assert.ok(p.position.distanceTo(fx.parts[n].centre) < 1e-9, n);
        assert.ok(Math.abs(p.quaternion.w) > 1 - 1e-9, n);
      }
    });
  });
});
