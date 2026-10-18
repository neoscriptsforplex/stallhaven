/**
 * Falling sparkles for the magic tree.
 *
 * A single THREE.Points with additive blending. The particles spawn in an
 * ellipsoid shell around the canopy, drift down with a slight sway and a
 * twinkle, fade out just above the ground, then respawn in the canopy.
 * The spawn volume and the ground height come from the tree's bounding box,
 * so it works at any scale.
 *
 *   const fx = createMagicSparkles(treeVisual);   // adds itself as a child
 *   ...
 *   fx.update(dt);                                  // once per frame, dt in seconds
 *   fx.dispose();                                   // when the tree is removed
 *
 * Put it on the 'pine-visual' group so it hides with the crown when the tree
 * is felled (setTreeFallen toggles that group's visibility).
 */
import * as THREE from 'three';

export const MAGIC_SPARKLE_DEFAULTS = Object.freeze({
  count: 60,
  /** One colour or a list; each particle picks one. White by default. */
  colors: [0xffffff, 0xffffff, 0xfffdf5, 0xf6faff],
  /** Falling speed, in tree heights per second. 0.07 ≈ 0.35 m/s on a 5 m tree. */
  speed: 0.07,
  /** Random spread of the speed (±fraction). */
  speedJitter: 0.35,
  /** Side-to-side sway amplitude, in tree heights. */
  sway: 0.025,
  /** Point size in world units (perspective-attenuated). */
  size: 0.09,
  /** Canopy band as fractions of the box height (0 = ground, 1 = top). */
  canopyBottom: 0.57,
  canopyTop: 0.97,
  /** Canopy radius as a fraction of the box half-width/half-depth. */
  canopyRadius: 0.95,
  /** Spawn shell, as fractions of the canopy ellipsoid radius. */
  shellInner: 0.85,
  shellOuter: 1.12,
  /** Fade out over this fraction of the tree height above the ground. */
  fadeBand: 0.14,
  /** Ground offset above the box bottom, in tree heights. */
  groundLift: 0.01,
  /** Seconds to fade in after spawning. */
  fadeIn: 0.5,
  /** Twinkle strength 0..1. */
  twinkle: 0.35,
  /** Overall brightness multiplier. */
  intensity: 1,
  /** Optional: a THREE.Box3 in the parent's local space to use instead of measuring. */
  box: null,
  /** Optional parent (defaults to the tree object itself). */
  parent: null,
  /** Optional random source for tests. */
  random: Math.random,
});

/** Bounding box of `root`'s meshes in root's own local space. */
function localBox(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  const m = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.userData?.magicSparkles) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    tmp.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    box.union(tmp);
  });
  return box;
}

/** Soft round dot, built as data so it works without a DOM canvas. */
function dotTexture(size = 32) {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x - c, y - c) / c;
      const core = Math.max(0, 1 - d);
      const a = Math.min(1, core * core * 1.6 + Math.max(0, 1 - d * 3.2));
      const i = (y * size + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = Math.round(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export function createMagicSparkles(tree, opts = {}) {
  const o = { ...MAGIC_SPARKLE_DEFAULTS, ...opts };
  const rnd = o.random;
  const parent = o.parent ?? tree;
  const box = o.box ? o.box.clone() : localBox(parent);
  if (box.isEmpty()) throw new Error('createMagicSparkles: tree has no mesh bounds');
  const size = box.getSize(new THREE.Vector3());
  const H = size.y;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const y0 = box.min.y + H * o.canopyBottom;
  const y1 = box.min.y + H * o.canopyTop;
  const cy = (y0 + y1) / 2;
  const ry = (y1 - y0) / 2;
  const rx = (size.x / 2) * o.canopyRadius;
  const rz = (size.z / 2) * o.canopyRadius;
  const ground = box.min.y + H * o.groundLift;
  const fadeH = Math.max(H * o.fadeBand, 1e-4);

  const n = Math.max(1, Math.floor(o.count));
  const palette = (Array.isArray(o.colors) ? o.colors : [o.colors]).map((c) => new THREE.Color(c));
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  // per particle: base x/z, y, fall speed, sway phase, sway freq, age, twinkle phase, colour index
  const bx = new Float32Array(n), bz = new Float32Array(n), py = new Float32Array(n);
  const vy = new Float32Array(n), ph = new Float32Array(n), fq = new Float32Array(n);
  const age = new Float32Array(n), tw = new Float32Array(n), ci = new Uint8Array(n);

  function spawn(i, anywhere) {
    // uniform direction, radius in the shell, lower hemisphere weighted a bit
    // so most sparkles appear at the canopy's sides and underside
    let ux, uy, uz, l;
    do {
      ux = rnd() * 2 - 1; uy = rnd() * 2 - 1; uz = rnd() * 2 - 1; l = ux * ux + uy * uy + uz * uz;
    } while (l > 1 || l < 1e-4);
    l = Math.sqrt(l); ux /= l; uy /= l; uz /= l;
    if (uy > 0.4 && rnd() < 0.5) uy = -uy;
    const r = o.shellInner + (o.shellOuter - o.shellInner) * rnd();
    bx[i] = cx + ux * rx * r;
    bz[i] = cz + uz * rz * r;
    py[i] = cy + uy * ry * r;
    if (anywhere) py[i] = ground + (py[i] - ground) * rnd(); // first fill: spread down the fall
    vy[i] = H * o.speed * (1 + (rnd() * 2 - 1) * o.speedJitter);
    ph[i] = rnd() * Math.PI * 2;
    fq[i] = 0.6 + rnd() * 0.9;
    tw[i] = rnd() * Math.PI * 2;
    age[i] = anywhere ? o.fadeIn : 0;
    ci[i] = Math.floor(rnd() * palette.length) % palette.length;
  }
  for (let i = 0; i < n; i += 1) spawn(i, true);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  // fixed bounds (the whole fall volume) so frustum culling never needs a recompute
  geometry.boundingBox = new THREE.Box3(
    new THREE.Vector3(cx - rx * o.shellOuter - H * o.sway, ground, cz - rz * o.shellOuter - H * o.sway),
    new THREE.Vector3(cx + rx * o.shellOuter + H * o.sway, cy + ry * o.shellOuter, cz + rz * o.shellOuter + H * o.sway),
  );
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  const map = dotTexture();
  const material = new THREE.PointsMaterial({
    size: o.size,
    map,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'magic-sparkles';
  points.userData.magicSparkles = true;
  points.raycast = () => {}; // never steals tree clicks
  points.renderOrder = 2;
  parent.add(points);

  let time = 0;
  function write() {
    const swayA = H * o.sway;
    for (let i = 0; i < n; i += 1) {
      const s = Math.sin(time * fq[i] + ph[i]);
      const c = Math.cos(time * fq[i] * 0.8 + ph[i] * 1.3);
      const j = i * 3;
      pos[j] = bx[i] + s * swayA;
      pos[j + 1] = py[i];
      pos[j + 2] = bz[i] + c * swayA;
      const fadeIn = Math.min(1, age[i] / o.fadeIn);
      const fadeOut = Math.min(1, Math.max(0, (py[i] - ground) / fadeH));
      const twinkle = 1 - o.twinkle * (0.5 + 0.5 * Math.sin(time * 7 + tw[i]));
      const b = fadeIn * fadeOut * fadeOut * twinkle * o.intensity; // additive: darker = more transparent
      const p = palette[ci[i]];
      col[j] = p.r * b; col[j + 1] = p.g * b; col[j + 2] = p.b * b;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }
  write();

  return {
    points,
    /** Advance by dt seconds. Large dt (tab was hidden) is clamped. */
    update(dt) {
      const d = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
      if (!d) return;
      time += d;
      for (let i = 0; i < n; i += 1) {
        age[i] += d;
        py[i] -= vy[i] * d;
        if (py[i] <= ground) spawn(i, false);
      }
      write();
    },
    /** Change the colour(s) at runtime. */
    setColors(colors) {
      const list = (Array.isArray(colors) ? colors : [colors]).map((c) => new THREE.Color(c));
      palette.length = 0; palette.push(...list);
      for (let i = 0; i < n; i += 1) ci[i] = Math.floor(rnd() * palette.length) % palette.length;
    },
    /** Current positions in the parent's local space (Float32Array, xyz). */
    positions: pos,
    /** Current per-particle brightness colours (Float32Array, rgb). */
    colors: col,
    dispose() {
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
      map.dispose();
    },
  };
}
