/**
 * Flowing water for the Runecraft fountain (low-poly, OSRS-ish, cheap).
 *
 *   const fx = attachFountainWater(fountainGroup);   // adds its meshes as children
 *   fx.update(dt);                                     // each frame, dt in seconds
 *   fx.dispose();
 *
 * What it adds (all measured from the model, in the fountain's local space):
 *  - arcing jets from the finial (spout) down into the top bowl,
 *  - overflow streams spilling from each bowl rim into the level below,
 *  - droplet chunks running down every stream (one InstancedMesh),
 *  - expanding splash ripples where the streams land (one InstancedMesh, additive),
 *  - a gently bobbing, shimmering water sheet on each pool.
 * Pools are found from the dump's blue, upward-facing faces (y and radius per level);
 * the spout is the top of the model. Draw calls: 3 + one per pool. ~100 instance
 * updates per frame.
 */
import * as THREE from 'three';

export const FOUNTAIN_WATER_DEFAULTS = Object.freeze({
  jets: 6,                 // arcs from the spout into the top bowl
  overflowPerLevel: [8, 12], // streams from the top bowl, then from the next bowl (repeats last)
  dropsPerJet: 5,
  dropsPerOverflow: 4,
  flowSpeed: 0.9,          // stream passes per second
  jetRise: 0.06,           // jet apex above the spout, in model heights
  jetReach: 0.55,          // jet landing radius as a fraction of the top pool radius
  colour: 0x8fd3f2,
  dropColour: 0xd8f4ff,
  rippleColour: 0x9fdcf5,
  streamOpacity: 0.5,
  surfaceOpacity: 0.28,
  bob: 0.006,              // pool sheet bob amplitude, in model heights
  levels: null,            // override: [{ y, r, x, z }] pools, top first, basin last (local units)
  spout: null,             // override: THREE.Vector3 (local units)
  random: Math.random,
});

function isWaterColour(c) {
  return c && c.b > c.r * 1.25 && c.b > c.g * 1.05 && c.b > 0.08;
}

/** Collect upward-facing triangles with blue materials, grouped by height. */
function findPools(root, height) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const pts = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const m = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || o.userData?.fountainFx) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const g = o.geometry;
    const pos = g.attributes.position;
    const index = g.index;
    const groups = g.groups.length ? g.groups : [{ start: 0, count: index ? index.count : pos.count, materialIndex: 0 }];
    m.multiplyMatrices(toRoot, o.matrixWorld);
    for (const gr of groups) {
      const mat = Array.isArray(o.material) ? mats[gr.materialIndex ?? 0] : o.material;
      if (!isWaterColour(mat?.color) || mat.transparent) continue; // dump water faces are opaque; skip other fx
      for (let i = gr.start; i + 2 < gr.start + gr.count; i += 3) {
        const ia = index ? index.getX(i) : i, ib = index ? index.getX(i + 1) : i + 1, ic = index ? index.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, ia).applyMatrix4(m);
        b.fromBufferAttribute(pos, ib).applyMatrix4(m);
        c.fromBufferAttribute(pos, ic).applyMatrix4(m);
        n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
        const len = n.length();
        if (len < 1e-12 || n.y / len < 0.9) continue;
        pts.push(a.clone(), b.clone(), c.clone());
      }
    }
  });
  if (!pts.length) return [];
  pts.sort((p, q) => q.y - p.y);
  const tol = height * 0.03;
  const levels = [];
  for (const p of pts) {
    let lv = levels.find((l) => Math.abs(l.y - p.y) < tol);
    if (!lv) { lv = { y: p.y, pts: [] }; levels.push(lv); }
    lv.pts.push(p);
  }
  return levels.map((lv) => {
    const box = new THREE.Box3().setFromPoints(lv.pts);
    const ctr = box.getCenter(new THREE.Vector3());
    const r = Math.max(...lv.pts.map((p) => Math.hypot(p.x - ctr.x, p.z - ctr.z)));
    const y = lv.pts.reduce((s, p) => s + p.y, 0) / lv.pts.length;
    return { y, r, x: ctr.x, z: ctr.z };
  }).sort((p, q) => q.y - p.y);
}

function localBox(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3(), tmp = new THREE.Box3(), m = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.userData?.fountainFx || !o.visible) return;
    if (o.material && !Array.isArray(o.material) && o.material.opacity === 0) return; // invisible pick boxes
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    tmp.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    box.union(tmp);
  });
  return box;
}

/** y(t) = y0 + b t - a t^2 with y(1) = y1 and apex y0 + rise. */
function arc(y0, y1, rise) {
  const d = Math.max(1e-6, y0 - y1);
  const h = Math.max(0, rise);
  const A = d + 2 * h + 2 * Math.sqrt(h * h + h * d);
  return { a: A, b: A - d };
}

export function attachFountainWater(root, opts = {}) {
  const o = { ...FOUNTAIN_WATER_DEFAULTS, ...opts };
  const rnd = o.random;
  const box = localBox(root);
  if (box.isEmpty()) throw new Error('attachFountainWater: fountain has no mesh bounds');
  const H = box.max.y - box.min.y;
  let levels = o.levels ?? findPools(root, H);
  if (!levels.length) {
    // no blue faces: fall back to the procedural fountain's proportions
    const R = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    levels = [
      { y: box.min.y + H * 0.82, r: R * 0.3, x: cx, z: cz },
      { y: box.min.y + H * 0.32, r: R * 0.72, x: cx, z: cz },
    ];
  }
  const top = levels[0];
  const cx = top.x, cz = top.z;
  const spout = o.spout ? o.spout.clone() : new THREE.Vector3(cx, box.max.y - H * 0.07, cz);

  // ---------- streams
  const streams = [];
  for (let k = 0; k < o.jets; k += 1) {
    const ang = (k / o.jets) * Math.PI * 2 + 0.3;
    streams.push({
      kind: 'jet', ang, cx, cz,
      r0: H * 0.012, y0: spout.y, r1: top.r * o.jetReach, y1: top.y,
      ...arc(spout.y, top.y, H * o.jetRise),
      w: H * 0.009, t: H * 0.009, drops: o.dropsPerJet,
    });
  }
  for (let i = 0; i < levels.length - 1; i += 1) {
    const hi = levels[i], lo = levels[i + 1];
    const n = o.overflowPerLevel[Math.min(i, o.overflowPerLevel.length - 1)];
    const rim = hi.r + H * 0.02;
    const land = Math.min(rim + H * 0.06 + (hi.y - lo.y) * 0.12, lo.r * 0.94);
    for (let k = 0; k < n; k += 1) {
      const ang = (k / n) * Math.PI * 2 + (i % 2 ? Math.PI / n : 0);
      streams.push({
        kind: 'overflow', ang, cx: hi.x, cz: hi.z,
        r0: rim, y0: hi.y + H * 0.012, r1: Math.max(land, rim + H * 0.02), y1: lo.y,
        ...arc(hi.y + H * 0.012, lo.y, H * 0.008),
        w: H * 0.03, t: H * 0.007, drops: o.dropsPerOverflow,
      });
    }
  }
  const at = (s, t, out) => {
    const r = s.r0 + (s.r1 - s.r0) * t;
    return out.set(s.cx + Math.cos(s.ang) * r, s.y0 + s.b * t - s.a * t * t, s.cz + Math.sin(s.ang) * r);
  };

  // ---------- stream ribbons: one merged low-poly mesh (4-sided strip per stream)
  const SEG = 7;
  const verts = [];
  const idx = [];
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (const s of streams) {
    const base = verts.length / 3;
    const tang = new THREE.Vector3(-Math.sin(s.ang), 0, Math.cos(s.ang)); // across the stream
    const rad = new THREE.Vector3(Math.cos(s.ang), 0, Math.sin(s.ang));
    for (let j = 0; j <= SEG; j += 1) {
      const t = j / SEG;
      at(s, t, p);
      const taper = s.kind === 'jet' ? 0.6 + 0.6 * t : 1 + 0.35 * t;
      const w = s.w * 0.5 * taper, th = s.t * 0.5 * taper;
      for (const [u, v] of [[w, 0], [0, th], [-w, 0], [0, -th]]) {
        q.copy(p).addScaledVector(tang, u).addScaledVector(rad, v);
        verts.push(q.x, q.y, q.z);
      }
    }
    for (let j = 0; j < SEG; j += 1) {
      for (let k = 0; k < 4; k += 1) {
        const a0 = base + j * 4 + k, a1 = base + j * 4 + ((k + 1) % 4);
        const b0 = a0 + 4, b1 = a1 + 4;
        idx.push(a0, b0, a1, a1, b0, b1);
      }
    }
  }
  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  ribbonGeo.setIndex(idx);
  ribbonGeo.computeVertexNormals();
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: o.colour, roughness: 0.1, metalness: 0.1, transparent: true, opacity: o.streamOpacity,
    emissive: 0x1d5a7a, emissiveIntensity: 0.25, depthWrite: false, side: THREE.DoubleSide, flatShading: true,
  });
  const ribbons = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbons.name = 'fountain-streams';

  // ---------- droplets running down the streams
  const dropTotal = streams.reduce((sum, s) => sum + s.drops, 0);
  const dropGeo = new THREE.OctahedronGeometry(H * 0.011, 0);
  const dropMat = new THREE.MeshStandardMaterial({
    color: o.dropColour, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85,
    emissive: 0x2a6a8a, emissiveIntensity: 0.3, depthWrite: false, flatShading: true,
  });
  const drops = new THREE.InstancedMesh(dropGeo, dropMat, dropTotal);
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  drops.name = 'fountain-droplets';
  const dropOf = [];
  streams.forEach((s, si) => {
    for (let k = 0; k < s.drops; k += 1) dropOf.push({ s: si, phase: (k + rnd() * 0.6) / s.drops, speed: o.flowSpeed * (0.85 + rnd() * 0.3) });
  });

  // ---------- splash ripples (additive; fade by colour)
  const ringGeo = new THREE.RingGeometry(0.62, 1, 10, 1);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const ripples = new THREE.InstancedMesh(ringGeo, ringMat, streams.length);
  ripples.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ripples.setColorAt(0, new THREE.Color(0));
  ripples.instanceColor.setUsage(THREE.DynamicDrawUsage);
  ripples.name = 'fountain-ripples';
  const ripplePhase = streams.map(() => rnd());
  const rippleCol = new THREE.Color(o.rippleColour);

  // ---------- pool sheets
  const surfMat = new THREE.MeshStandardMaterial({
    color: o.colour, roughness: 0.05, metalness: 0.2, transparent: true, opacity: o.surfaceOpacity,
    emissive: 0x2a7aa0, emissiveIntensity: 0.2, depthWrite: false, flatShading: true,
  });
  const sheets = levels.map((lv, i) => {
    const g = new THREE.CircleGeometry(lv.r * 0.97, 10);
    g.rotateX(-Math.PI / 2);
    // a little low-poly relief so the shading shimmers as it turns
    const pos = g.attributes.position;
    for (let k = 1; k < pos.count; k += 1) pos.setY(k, (k % 2 ? 1 : -1) * H * 0.002);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, surfMat);
    mesh.name = `fountain-pool-${i}`;
    mesh.position.set(lv.x, lv.y + H * 0.004, lv.z);
    mesh.userData.baseY = mesh.position.y;
    mesh.renderOrder = 1;
    return mesh;
  });

  const group = new THREE.Group();
  group.name = 'fountain-water-fx';
  group.userData.fountainFx = true;
  for (const m of [ribbons, drops, ripples, ...sheets]) {
    m.userData.fountainFx = true;
    m.raycast = () => {};       // never block the fountain pick
    m.castShadow = false;
    m.renderOrder = Math.max(m.renderOrder, 2);
    group.add(m);
  }
  root.add(group);

  const dummy = new THREE.Object3D();
  const tmpC = new THREE.Color();
  let time = 0;
  function write() {
    dropOf.forEach((d, i) => {
      const s = streams[d.s];
      const t = (d.phase + time * d.speed) % 1;
      at(s, t, dummy.position);
      const sc = s.kind === 'jet' ? 0.7 + 0.5 * t : 0.9 + 0.4 * t;
      dummy.scale.set(sc, sc * 1.6, sc);
      dummy.rotation.set(0, s.ang + t * 3, 0);
      dummy.updateMatrix();
      drops.setMatrixAt(i, dummy.matrix);
    });
    drops.instanceMatrix.needsUpdate = true;
    streams.forEach((s, i) => {
      const t = (ripplePhase[i] + time * 0.8) % 1;
      at(s, 1, dummy.position);
      dummy.position.y += H * 0.006;
      const r = H * (0.012 + 0.05 * t) * (s.kind === 'jet' ? 0.8 : 1.1);
      dummy.scale.set(r, 1, r);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      ripples.setMatrixAt(i, dummy.matrix);
      ripples.setColorAt(i, tmpC.copy(rippleCol).multiplyScalar(0.55 * (1 - t) * (1 - t)));
    });
    ripples.instanceMatrix.needsUpdate = true;
    ripples.instanceColor.needsUpdate = true;
    sheets.forEach((m, i) => {
      m.position.y = m.userData.baseY + Math.sin(time * 2.1 + i * 1.7) * H * o.bob;
      m.rotation.y = time * 0.15 * (i % 2 ? -1 : 1);
    });
    ribbonMat.opacity = o.streamOpacity * (0.88 + 0.12 * Math.sin(time * 9));
    surfMat.opacity = o.surfaceOpacity * (0.85 + 0.15 * Math.sin(time * 1.3));
  }
  write();

  return {
    group, levels, spout, streams,
    update(dt) {
      const d = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
      if (!d) return;
      time += d;
      write();
    },
    /** Current droplet positions (local), for previews/tests. */
    dropPositions() {
      const out = []; const m4 = new THREE.Matrix4(); const v = new THREE.Vector3();
      for (let i = 0; i < dropTotal; i += 1) { drops.getMatrixAt(i, m4); out.push(v.setFromMatrixPosition(m4).clone()); }
      return out;
    },
    dispose() {
      group.removeFromParent();
      for (const g of [ribbonGeo, dropGeo, ringGeo, ...sheets.map((s) => s.geometry)]) g.dispose();
      for (const m of [ribbonMat, dropMat, ringMat, surfMat]) m.dispose();
      drops.dispose?.(); ripples.dispose?.();
    },
  };
}
