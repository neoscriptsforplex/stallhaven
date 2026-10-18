/**
 * Gentle animated water for the fishing pond (low-poly, OSRS-ish, cheap).
 *
 *   const fx = attachPondWater(pondGroup, { spots });  // adds its meshes as children
 *   fx.update(dt);                                      // each frame, dt in seconds
 *   fx.dispose();
 *
 * Same shape as fountainWater.js, and shopbuild hangs it on
 * `group.userData.fountainFlow`, so the existing tickFountainWater call in
 * world.js drives it with no new hook.
 *
 * What it adds (pond-local metres, y up, origin at the pond centre):
 *  - a faceted translucent sheet over the model's water that slowly swells
 *    (vertex heights from two crossing sine waves, flat shaded),
 *  - expanding ripple rings at every fishing spot (one InstancedMesh, additive),
 *  - small bubbles popping at every spot (one InstancedMesh).
 * Draw calls: 3. About 100 vertex and 40 instance updates per frame.
 */
import * as THREE from 'three';

export const POND_WATER_DEFAULTS = Object.freeze({
  rx: 2.7,                 // ellipse half-axes, metres (layout.POND)
  rz: 2.1,
  y: 0.038,                // sheet height: just over the model's water top (3 OSRS units)
  rings: 4,
  segments: 28,
  swell: 0.006,            // sheet bob amplitude, metres
  swellSpeed: 0.7,
  colour: 0x9fd8f0,
  opacity: 0.22,
  rippleColour: 0xd8f2ff,
  ripplesPerSpot: 3,
  rippleLife: 2.2,         // seconds for one ring to grow and fade
  rippleRadius: 0.42,
  bubblesPerSpot: 4,
  bubbleColour: 0xeaf8ff,
  spots: [],               // [{ x, z }] pond-local metres
  random: Math.random,
});

function ellipseSheet(rx, rz, rings, segments) {
  const pos = [0, 0, 0];
  for (let r = 1; r <= rings; r += 1) {
    const s = r / rings;
    for (let k = 0; k < segments; k += 1) {
      const a = (k / segments) * Math.PI * 2;
      pos.push(Math.cos(a) * rx * s, 0, Math.sin(a) * rz * s);
    }
  }
  const index = [];
  for (let k = 0; k < segments; k += 1) {
    index.push(0, 1 + ((k + 1) % segments), 1 + k);
  }
  for (let r = 1; r < rings; r += 1) {
    const a0 = 1 + (r - 1) * segments;
    const b0 = 1 + r * segments;
    for (let k = 0; k < segments; k += 1) {
      const k1 = (k + 1) % segments;
      index.push(a0 + k, a0 + k1, b0 + k1, a0 + k, b0 + k1, b0 + k);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  // Index runs counter-clockwise seen from above, so faces point up.
  const nonIndexed = geo.toNonIndexed();
  geo.dispose();
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}

export function attachPondWater(root, opts = {}) {
  const o = { ...POND_WATER_DEFAULTS, ...opts };
  const rand = o.random;
  const group = new THREE.Group();
  group.name = 'pond-water-fx';
  group.userData.fountainFx = true;
  root.add(group);

  const sheetGeo = ellipseSheet(o.rx * 0.985, o.rz * 0.985, o.rings, o.segments);
  const base = sheetGeo.attributes.position.array.slice();
  const sheetMat = new THREE.MeshStandardMaterial({
    color: o.colour,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: o.opacity,
    depthWrite: false,
    flatShading: true,
  });
  const sheet = new THREE.Mesh(sheetGeo, sheetMat);
  sheet.name = 'pond-sheet';
  sheet.position.y = o.y;
  sheet.renderOrder = 2;
  sheet.userData.fountainFx = true;
  group.add(sheet);

  const spots = (o.spots ?? []).map((spot) => ({ x: spot.x, z: spot.z }));
  const rippleCount = Math.max(1, spots.length * o.ripplesPerSpot);
  const rippleGeo = new THREE.RingGeometry(0.82, 1, 18, 1);
  rippleGeo.rotateX(-Math.PI / 2);
  const rippleMat = new THREE.MeshBasicMaterial({
    color: o.rippleColour,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ripples = new THREE.InstancedMesh(rippleGeo, rippleMat, rippleCount);
  ripples.name = 'pond-ripples';
  ripples.renderOrder = 3;
  ripples.frustumCulled = false;
  ripples.userData.fountainFx = true;
  ripples.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(rippleCount * 3), 3);
  group.add(ripples);
  const rippleAge = Array.from({ length: rippleCount }, (_, i) => (i % o.ripplesPerSpot) / o.ripplesPerSpot * o.rippleLife);

  const bubbleCount = Math.max(1, spots.length * o.bubblesPerSpot);
  const bubbleGeo = new THREE.IcosahedronGeometry(0.035, 0);
  const bubbleMat = new THREE.MeshStandardMaterial({
    color: o.bubbleColour, roughness: 0.2, transparent: true, opacity: 0.85, depthWrite: false,
  });
  const bubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, bubbleCount);
  bubbles.name = 'pond-bubbles';
  bubbles.renderOrder = 3;
  bubbles.frustumCulled = false;
  bubbles.userData.fountainFx = true;
  group.add(bubbles);
  const bubbleState = Array.from({ length: bubbleCount }, () => ({
    t: rand(), life: 0.7 + rand() * 0.7, dx: (rand() - 0.5) * 0.3, dz: (rand() - 0.5) * 0.3,
  }));

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  const white = new THREE.Color(o.rippleColour);
  let time = 0;

  function stepSheet() {
    const pos = sheetGeo.attributes.position;
    const arr = pos.array;
    const w = time * o.swellSpeed;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const z = base[i + 2];
      const edge = Math.min(1, Math.hypot(x / o.rx, z / o.rz));
      const damp = 1 - edge * edge * 0.85;
      arr[i + 1] = o.swell * damp * (Math.sin(x * 2.3 + w * 2.1) + Math.cos(z * 2.9 - w * 1.7) * 0.7);
    }
    pos.needsUpdate = true;
    sheetGeo.computeVertexNormals();
  }

  function stepRipples(dt) {
    for (let i = 0; i < rippleCount; i += 1) {
      const spot = spots[Math.floor(i / o.ripplesPerSpot)];
      if (!spot) {
        m.makeScale(0, 0, 0);
        ripples.setMatrixAt(i, m);
        continue;
      }
      rippleAge[i] = (rippleAge[i] + dt) % o.rippleLife;
      const t = rippleAge[i] / o.rippleLife;
      const r = 0.06 + o.rippleRadius * t;
      p.set(spot.x, o.y + 0.006, spot.z);
      s.set(r, 1, r);
      m.compose(p, q.identity(), s);
      ripples.setMatrixAt(i, m);
      ripples.setColorAt(i, c.copy(white).multiplyScalar((1 - t) * (1 - t)));
    }
    ripples.instanceMatrix.needsUpdate = true;
    if (ripples.instanceColor) ripples.instanceColor.needsUpdate = true;
  }

  function stepBubbles(dt) {
    for (let i = 0; i < bubbleCount; i += 1) {
      const spot = spots[Math.floor(i / o.bubblesPerSpot)];
      const b = bubbleState[i];
      if (!spot) {
        m.makeScale(0, 0, 0);
        bubbles.setMatrixAt(i, m);
        continue;
      }
      b.t += dt / b.life;
      if (b.t >= 1) {
        b.t = 0;
        b.life = 0.7 + rand() * 0.7;
        b.dx = (rand() - 0.5) * 0.3;
        b.dz = (rand() - 0.5) * 0.3;
      }
      const grow = Math.sin(Math.min(1, b.t) * Math.PI);
      p.set(spot.x + b.dx, o.y + 0.012 + b.t * 0.03, spot.z + b.dz);
      s.setScalar(0.4 + grow * 0.8);
      m.compose(p, q.identity(), s);
      bubbles.setMatrixAt(i, m);
    }
    bubbles.instanceMatrix.needsUpdate = true;
  }

  function update(dt = 0) {
    const step = Math.min(0.1, Math.max(0, Number(dt) || 0));
    time += step;
    stepSheet();
    stepRipples(step);
    stepBubbles(step);
  }

  function dispose() {
    group.removeFromParent();
    sheetGeo.dispose();
    sheetMat.dispose();
    rippleGeo.dispose();
    rippleMat.dispose();
    bubbleGeo.dispose();
    bubbleMat.dispose();
  }

  update(0);
  return { group, update, dispose };
}
