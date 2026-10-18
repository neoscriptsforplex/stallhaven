/**
 * Furnace smelting effect: a few metal bars slide into the oven mouth, heat up and glow,
 * the chamber flickers orange and a cheap point light pulses. Hidden when idle.
 *
 *   const fx = attachFurnaceFx(furnaceRoot);
 *   fx.setActive(true, 0x3a6ec8);   // smelting started; tint = bar colour (RECIPES[id].tint)
 *   fx.update(dt);                  // every frame
 *
 * Everything is authored in the dump's own OSRS units and parented next to the dump mesh
 * with its transform, so it follows wrapBundledProp scaling, recentring and placement.
 * Measured from public/models/furnace/furnace.obj (the "Pottery Oven" dump): the oven
 * chamber floor is y=128, x -65..66, z -60..-4, its mouth opens toward -Z at z≈-64;
 * a small firebox glows at x≈36, y 0..35, z≈-40.
 */
import * as THREE from 'three';

export const FURNACE_FX_DEFAULTS = Object.freeze({
  floorY: 128,             // chamber floor (model units)
  barZ: -40,               // resting row of bars (just inside the mouth)
  mouthZ: -64,             // mouth plane; bars slide in from beyond it
  slideFrom: -96,          // start z of the slide
  barSpread: 15,           // x spacing of the bottom bars
  fire: [[-36, 128, -14], [-12, 128, -10], [12, 128, -10], [36, 128, -14], [30, 4, -38], [40, 4, -42]],  // flame tongues
  lightPos: [0, 150, -60],
  light: true,             // one PointLight, kept at intensity 0 when idle (no shader recompiles)
  lightIntensity: 1.1,
  lightDistance: 2.4,      // world units (after fitting)
  slideTime: 0.45,         // seconds to slide in / out
  heatTime: 2.2,           // seconds for bars to reach full glow
  defaultTint: 0xc5ccd4,   // steel-ish when the craft has no known metal
  hotColor: 0xff6a1a,
  glowMinR: 0.45,          // chamber faces counted as "hot" (dump Kd red/orange)
});

function smooth(t) { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); }

/** Low-poly ingot: a frustum box, 12 tris, base on y=0, long along x. */
function barGeometry() {
  const L = 15, W = 6.5, l = 11.5, w = 4, H = 5.5;
  const v = [
    [-L, 0, -W], [L, 0, -W], [L, 0, W], [-L, 0, W],
    [-l, H, -w], [l, H, -w], [l, H, w], [-l, H, w],
  ];
  const quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  const pos = [];
  for (const [a, b, c, d] of quads) for (const i of [a, b, c, a, c, d]) pos.push(...v[i]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function findDump(root) {
  let best = null; let n = -1;
  root.traverse((o) => {
    if (!o.isMesh || o.userData.stationFx) return;
    const c = o.geometry?.attributes?.position?.count ?? 0;
    if (c > n) { n = c; best = o; }
  });
  return best;
}

export function attachFurnaceFx(root, opts = {}) {
  const o = { ...FURNACE_FX_DEFAULTS, ...opts };
  const dump = findDump(root);
  if (!dump || !dump.parent) return null;
  const rand = o.random ?? Math.random;

  // fx group shares the dump mesh's transform -> author in model units
  const group = new THREE.Group();
  group.name = 'furnace-fx';
  group.userData.stationFx = true;
  dump.updateMatrix();
  group.matrix.copy(dump.matrix);
  group.matrix.decompose(group.position, group.quaternion, group.scale);
  dump.parent.add(group);

  // bars: two on the floor, one across the top
  const barMat = new THREE.MeshStandardMaterial({ color: o.defaultTint, roughness: 0.45, metalness: 0.6, emissive: o.hotColor, emissiveIntensity: 0 });
  const barGeo = barGeometry();
  const bars = new THREE.Group();
  bars.name = 'furnace-bars';
  const layout = [[-o.barSpread, 0, 0, 0], [o.barSpread, 0, 0, 0], [0, 5.5, 0, Math.PI / 2 + 0.15]];
  for (const [x, y, z, ry] of layout) {
    const m = new THREE.Mesh(barGeo, barMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.userData.stationFx = true;
    m.raycast = () => {};
    bars.add(m);
  }
  bars.position.set(0, o.floorY + 0.2, o.slideFrom);
  bars.visible = false;
  group.add(bars);

  // flame tongues (additive cones that flicker)
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flameGeo = new THREE.ConeGeometry(9, 18, 6, 1, true);
  flameGeo.translate(0, 9, 0);
  const flames = o.fire.map(([x, y, z], i) => {
    const f = new THREE.Mesh(flameGeo, flameMat);
    f.position.set(x, y, z);
    f.userData.stationFx = true;
    f.userData.phase = i * 1.7;
    f.raycast = () => {};
    f.visible = false;
    group.add(f);
    return f;
  });

  // chamber glow: clone the dump's hot (red/orange) materials so the bundled look stays untouched
  const hotMats = [];
  const mats = Array.isArray(dump.material) ? dump.material : [dump.material];
  const cloned = mats.map((m) => {
    if (!m?.color) return m;
    const c = m.color; // linear
    const s = {}; c.getRGB(s, THREE.SRGBColorSpace);
    if (s.r > o.glowMinR && s.g < 0.6 * s.r && s.b < 0.4 * s.r && 'emissive' in m) {
      const k = m.clone();
      k.emissive = c.clone();
      k.emissiveIntensity = 0;
      hotMats.push(k);
      return k;
    }
    return m;
  });
  const originalMaterial = dump.material;
  if (hotMats.length) dump.material = Array.isArray(dump.material) ? cloned : cloned[0];

  let light = null;
  if (o.light) {
    light = new THREE.PointLight(0xff7a28, 0, o.lightDistance, 2);
    light.position.fromArray(o.lightPos);
    group.add(light);
  }

  const tint = new THREE.Color(o.defaultTint);
  const hot = new THREE.Color(o.hotColor);
  let target = 0; let slide = 0; let heat = 0; let t = 0;

  return {
    group, bars, flames, hotMaterials: hotMats, light,
    setActive(on, barTint) {
      target = on ? 1 : 0;
      if (on) {
        tint.set(barTint ?? o.defaultTint);
        barMat.color.copy(tint);
        // glow toward the bar's own colour, pushed hot
        barMat.emissive.copy(tint).lerp(hot, 0.5);
      }
    },
    update(dt) {
      const d = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
      if (!d) return;
      t += d;
      slide = target ? Math.min(1, slide + d / o.slideTime) : Math.max(0, slide - d / o.slideTime);
      heat = target ? Math.min(1, heat + d / o.heatTime) : Math.max(0, heat - d / (o.slideTime * 1.5));
      const s = smooth(slide);
      const on = s > 0;
      bars.visible = on;
      bars.position.z = o.slideFrom + (o.barZ - o.slideFrom) * s;
      const flick = 0.75 + 0.15 * Math.sin(t * 13.1) + 0.1 * Math.sin(t * 29.7 + 1.3) + 0.08 * (rand() - 0.5);
      barMat.emissiveIntensity = 0.08 + 0.4 * heat * flick;
      for (const f of flames) {
        f.visible = on;
        if (!on) continue;
        const p = f.userData.phase;
        const k = s * (0.7 + 0.3 * Math.sin(t * 11 + p) + 0.15 * Math.sin(t * 23 + p * 2));
        f.scale.set(0.8 + 0.2 * k, Math.max(0.05, k), 0.8 + 0.2 * k);
      }
      const glow = s * (0.55 + 0.45 * flick);
      for (const m of hotMats) m.emissiveIntensity = 0.9 * glow;
      if (light) light.intensity = o.lightIntensity * glow;
    },
    level() { return smooth(slide); },
    dispose() {
      dump.material = originalMaterial;
      for (const m of hotMats) m.dispose();
      barMat.dispose(); barGeo.dispose(); flameMat.dispose(); flameGeo.dispose();
      group.removeFromParent();
    },
  };
}
