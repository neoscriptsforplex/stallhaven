/**
 * Cooking range effect: while something cooks, a stew surface rises in the pot and
 * bubbles, a few food chunks bob and drift round, and soft steam puffs rise and fade
 * (plus a wisp of chimney smoke). Everything hides again when idle.
 *
 *   const fx = attachRangeFx(rangeRoot);
 *   fx.setActive(true);   // cooking started
 *   fx.update(dt);        // every frame
 *
 * Authored in the dump's own OSRS units, parented next to the dump mesh with its
 * transform, so it follows wrapBundledProp/sinkRangePlate. Measured from
 * public/models/range/range.obj: the pot is an open octagonal pot at (20, -44),
 * radius ~23, floor y=96, rim y=120; the chimney top is at (8, 224, 48).
 */
import * as THREE from 'three';

export const RANGE_FX_DEFAULTS = Object.freeze({
  pot: [20, -44],
  potRadius: 21,           // inner radius used for the stew disc (rim is ~23)
  stewY: 114,              // stew surface when full (rim 120)
  stewLowY: 100,           // where it sinks to when idle (hidden inside the pot)
  stewColor: 0x7a4a24,
  chunks: [0xd8782a, 0xe6d6a0, 0x6e3a22, 0xd8782a, 0x5a8a3a, 0xe6d6a0, 0x8a4a2a],
  steamCount: 7,
  steamColor: 0xe8e8e4,
  steamRise: 70,           // model units a puff rises before it is gone
  steamLife: 2.4,          // seconds
  chimney: [8, 226, 48],
  smokeCount: 3,
  smokeColor: 0x8a8a8a,
  easeTime: 0.5,
});

function smooth(t) { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); }

function findDump(root) {
  let best = null; let n = -1;
  root.traverse((o) => {
    if (!o.isMesh || o.userData.stationFx) return;
    const c = o.geometry?.attributes?.position?.count ?? 0;
    if (c > n) { n = c; best = o; }
  });
  return best;
}

/** Disc with a centre, an inner ring and a rim ring; inner verts can bob for bubbling. */
function stewGeometry(r, sides = 10) {
  const pos = [0, 0, 0];
  for (const rr of [r * 0.5, r]) for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2 + (rr === r ? 0 : Math.PI / sides);
    pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr);
  }
  const idx = [];
  for (let k = 0; k < sides; k++) {
    const i0 = 1 + k, i1 = 1 + ((k + 1) % sides);
    idx.push(0, i1, i0);
    const o0 = 1 + sides + k, o1 = 1 + sides + ((k + 1) % sides);
    idx.push(i0, o1, o0, i0, i1, o1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function attachRangeFx(root, opts = {}) {
  const o = { ...RANGE_FX_DEFAULTS, ...opts };
  const dump = findDump(root);
  if (!dump || !dump.parent) return null;
  const rand = o.random ?? Math.random;
  const noFx = () => {};

  const group = new THREE.Group();
  group.name = 'range-fx';
  group.userData.stationFx = true;
  dump.updateMatrix();
  group.matrix.copy(dump.matrix);
  group.matrix.decompose(group.position, group.quaternion, group.scale);
  group.visible = false;
  dump.parent.add(group);
  const [px, pz] = o.pot;

  // stew surface
  const stewGeo = stewGeometry(o.potRadius);
  const stewMat = new THREE.MeshStandardMaterial({ color: o.stewColor, roughness: 0.55, flatShading: true });
  const stew = new THREE.Mesh(stewGeo, stewMat);
  stew.name = 'range-stew';
  stew.position.set(px, o.stewLowY, pz);
  group.add(stew);

  // food chunks: one InstancedMesh of low-poly lumps
  const chunkGeo = new THREE.OctahedronGeometry(4.2, 0);
  const chunkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true });
  const chunks = new THREE.InstancedMesh(chunkGeo, chunkMat, o.chunks.length);
  chunks.name = 'range-food';
  const chunkState = o.chunks.map((c, i) => {
    chunks.setColorAt(i, new THREE.Color(c));
    return { a: (i / o.chunks.length) * Math.PI * 2, r: o.potRadius * (0.25 + 0.5 * ((i * 37) % 10) / 10), ph: i * 1.3, s: 0.8 + 0.4 * ((i * 53) % 10) / 10, spin: rand() * 6 };
  });
  group.add(chunks);

  // bubbles: small domes that swell and pop
  const bubbleGeo = new THREE.SphereGeometry(2.6, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  const bubbleMat = new THREE.MeshStandardMaterial({ color: 0x9a6232, roughness: 0.3, flatShading: true });
  const bubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, 4);
  bubbles.name = 'range-bubbles';
  const bubbleState = [0, 1, 2, 3].map((i) => ({ t: i * 0.33, x: 0, z: 0 }));
  group.add(bubbles);

  // steam and smoke puffs: individual meshes so each can fade on its own
  const puffGeo = new THREE.IcosahedronGeometry(5, 0);
  const mkPuff = (color, i, kind) => {
    const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0, depthWrite: false, flatShading: true });
    const m = new THREE.Mesh(puffGeo, mat);
    m.name = kind;
    m.userData.age = -i * (kind === 'range-steam' ? o.steamLife / o.steamCount : 1.1);
    m.userData.kind = kind;
    m.visible = false;
    group.add(m);
    return m;
  };
  const puffs = [];
  for (let i = 0; i < o.steamCount; i++) puffs.push(mkPuff(o.steamColor, i, 'range-steam'));
  for (let i = 0; i < o.smokeCount; i++) puffs.push(mkPuff(o.smokeColor, i, 'range-smoke'));
  group.traverse((m) => { m.userData.stationFx = true; if (m.isMesh) { m.raycast = noFx; m.castShadow = false; } });

  const mtx = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler();
  const v = new THREE.Vector3(); const sc = new THREE.Vector3();
  const pos = stewGeo.attributes.position;
  let target = 0; let level = 0; let t = 0;

  function respawn(p) {
    const steam = p.userData.kind === 'range-steam';
    p.userData.age = 0;
    if (steam) {
      const a = rand() * Math.PI * 2; const r = rand() * o.potRadius * 0.6;
      p.userData.x0 = px + Math.cos(a) * r; p.userData.z0 = pz + Math.sin(a) * r;
      p.userData.y0 = o.stewY + 2;
    } else {
      p.userData.x0 = o.chimney[0] + (rand() - 0.5) * 6; p.userData.z0 = o.chimney[2] + (rand() - 0.5) * 6;
      p.userData.y0 = o.chimney[1];
    }
    p.userData.drift = (rand() - 0.5) * 0.6;
    p.userData.live = target > 0;  // no new puffs once cooking stops
  }

  return {
    group, stew, chunks, bubbles, puffs,
    setActive(on) { target = on ? 1 : 0; },
    update(dt) {
      const d = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
      if (!d) return;
      t += d;
      level = target ? Math.min(1, level + d / o.easeTime) : Math.max(0, level - d / o.easeTime);
      const s = smooth(level);
      const puffsAlive = puffs.some((p) => p.visible);
      group.visible = s > 0 || puffsAlive;
      if (!group.visible) return;
      const y = o.stewLowY + (o.stewY - o.stewLowY) * s;
      stew.position.y = y;
      // inner ring + centre bob (rim ring stays put against the pot wall)
      for (let i = 0; i < 1 + 10; i++) {
        pos.setY(i, s * (0.9 * Math.sin(t * 3.1 + i * 1.7) + 0.5 * Math.sin(t * 5.3 + i * 0.9)));
      }
      pos.needsUpdate = true;
      stewGeo.computeVertexNormals();
      chunkState.forEach((c, i) => {
        c.a += d * 0.55 * s;
        c.spin += d * 0.8;
        const bob = 1.4 * Math.sin(t * 2.2 + c.ph) + 0.6 * Math.sin(t * 3.7 + c.ph * 2);
        v.set(px + Math.cos(c.a) * c.r, y + 1.5 + bob * s - (1 - s) * 6, pz + Math.sin(c.a) * c.r);
        q.setFromEuler(e.set(c.spin * 0.7, c.spin, c.ph));
        sc.setScalar(c.s * s);
        chunks.setMatrixAt(i, mtx.compose(v, q, sc));
      });
      chunks.instanceMatrix.needsUpdate = true;
      bubbleState.forEach((b, i) => {
        b.t += d * (0.9 + 0.2 * i);
        if (b.t >= 1) {
          b.t -= 1;
          const a = rand() * Math.PI * 2; const r = rand() * o.potRadius * 0.7;
          b.x = px + Math.cos(a) * r; b.z = pz + Math.sin(a) * r;
        }
        const k = b.t < 0.85 ? b.t / 0.85 : 0; // swell, then pop
        bubbles.setMatrixAt(i, mtx.compose(v.set(b.x, y + 0.2, b.z), q.identity(), sc.setScalar(Math.max(0.001, k * s))));
      });
      bubbles.instanceMatrix.needsUpdate = true;
      for (const p of puffs) {
        const steam = p.userData.kind === 'range-steam';
        const life = steam ? o.steamLife : 3.2;
        p.userData.age += d;
        if (p.userData.age < 0) { p.visible = false; continue; }
        if (p.userData.age >= life || p.userData.x0 === undefined) {
          if (target) respawn(p); else { p.visible = false; p.userData.live = false; continue; }
        }
        if (!p.userData.live) { p.visible = false; continue; }
        const u = p.userData.age / life;
        const rise = (steam ? o.steamRise : 90) * u;
        p.position.set(
          p.userData.x0 + Math.sin(t * 1.3 + p.userData.drift * 9) * 3 * u + p.userData.drift * 20 * u,
          p.userData.y0 + rise,
          p.userData.z0 + p.userData.drift * 12 * u,
        );
        p.scale.setScalar((steam ? 0.6 : 1.0) + (steam ? 1.6 : 2.2) * u);
        p.material.opacity = (steam ? 0.55 : 0.45) * Math.min(1, u * 5) * (1 - u) * (steam ? 1 : 0.9);
        p.visible = true;
      }
    },
    level() { return smooth(level); },
    dispose() {
      stewGeo.dispose(); stewMat.dispose(); chunkGeo.dispose(); chunkMat.dispose();
      bubbleGeo.dispose(); bubbleMat.dispose(); puffGeo.dispose();
      for (const p of puffs) p.material.dispose();
      group.removeFromParent();
    },
  };
}
