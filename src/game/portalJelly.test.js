import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './canvas-mock.js';
import * as THREE from 'three';
import { setBundledLook } from './models.js';
import { buildPortal } from './shopbuild.js';
import { parseModelBuffer } from './upload.js';
import { attachPortalJelly, isPortalSurfaceMaterial, tickPortalJelly } from './portalJelly.js';

const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

async function loadPortalDump() {
  const dir = new URL('../../public/models/portal/', import.meta.url);
  return parseModelBuffer(
    ab(readFileSync(new URL('portal.obj', dir))),
    'portal/portal.obj',
    { 'portal.mtl': ab(readFileSync(new URL('portal.mtl', dir))) },
  );
}

describe('portal jelly', () => {
  it('wobbles only the swirl disc, keeps the rim sealed and the base planted', async () => {
    const dump = await loadPortalDump();
    const sharedGeo = dump.getObjectByProperty('isMesh', true).geometry;
    const before = Float32Array.from(sharedGeo.attributes.position.array);
    setBundledLook('portal', dump);
    try {
      const portal = buildPortal();
      const jelly = portal.userData.portalJelly;
      assert.ok(jelly, 'buildPortal attaches a jelly');
      assert.equal(jelly.parts.length, 1);
      const p = jelly.parts[0];
      assert.equal(p.nSurf, 480 * 3, 'disc = the 480 purple triangles');
      assert.equal(p.nAxis, 2, 'disc faces +Z');
      assert.ok(Math.abs(p.radius - 130) < 1e-6);
      assert.notEqual(p.mesh.geometry, sharedGeo, 'geometry is cloned per portal');
      const mats = p.mesh.material;
      let maxCentre = 0;
      let maxRim = 0;
      let maxBaseDy = 0;
      let maxBaseDx = 0;
      const pos = p.geometry.attributes.position;
      for (let f = 0; f < 240; f += 1) {
        jelly.update(1 / 60);
        for (let i = 0; i < p.count; i += 1) {
          const dx = pos.getX(i) - p.base[i * 3];
          const dy = pos.getY(i) - p.base[i * 3 + 1];
          const dz = pos.getZ(i) - p.base[i * 3 + 2];
          assert.ok(Number.isFinite(dx + dy + dz));
          const d = Math.hypot(dx, dy, dz);
          if (p.surfaceVert[i] && p.rr[i] < 0.15) maxCentre = Math.max(maxCentre, d);
          if (p.surfaceVert[i] && p.rr[i] > 0.999) maxRim = Math.max(maxRim, Math.abs(dz));
          if (p.base[i * 3 + 1] < 0.5) {
            maxBaseDy = Math.max(maxBaseDy, Math.abs(dy));
            maxBaseDx = Math.max(maxBaseDx, Math.abs(dx));
          }
        }
      }
      assert.ok(maxCentre > 8, `centre should wobble visibly, got ${maxCentre}`);
      assert.ok(maxRim < 1e-3, `rim should not pull off the arch along Z, got ${maxRim}`);
      assert.ok(maxBaseDy < 1e-3 && maxBaseDx < 1e-3, `base must not float/slide (${maxBaseDx}, ${maxBaseDy})`);
      assert.equal(p.mesh.material, mats, 'materials untouched');
      assert.deepEqual(Array.from(sharedGeo.attributes.position.array), Array.from(before), 'bundled geometry untouched');

      portal.visible = false;
      const t0 = jelly.time;
      tickPortalJelly(portal, 0.05);
      assert.equal(jelly.time, t0, 'hidden portal does not step');
      portal.visible = true;
      tickPortalJelly(portal, 0.05);
      assert.ok(jelly.time > t0);

      jelly.dispose();
      assert.equal(p.mesh.geometry, sharedGeo, 'dispose restores the shared geometry');
    } finally {
      setBundledLook('portal', null);
    }
  });

  it('works on the procedural fallback portal (only the inner glow moves)', () => {
    const portal = buildPortal();
    const jelly = portal.userData.portalJelly;
    assert.ok(jelly);
    assert.equal(jelly.parts.length, 1);
    assert.equal(jelly.parts[0].mesh.userData.portalSurface, true);
    for (let i = 0; i < 30; i += 1) jelly.update(1 / 30);
    jelly.dispose();
  });

  it('classifies portal colours', () => {
    assert.equal(isPortalSurfaceMaterial({ color: new THREE.Color(0.55, 0.15, 0.85) }), true);
    assert.equal(isPortalSurfaceMaterial({ color: new THREE.Color(0.4, 0.38, 0.36) }), false);
    assert.equal(isPortalSurfaceMaterial({ color: new THREE.Color(0.2, 0.6, 0.2) }), false);
    assert.equal(attachPortalJelly(new THREE.Group()).parts.length, 0);
  });
});
