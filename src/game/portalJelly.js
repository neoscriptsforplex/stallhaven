/**
 * Jelly wobble for the portal (OSRS low-poly, cheap, always on).
 *
 *   const jelly = attachPortalJelly(portalVisual);   // clones the geometry it touches
 *   jelly.update(dt);                                 // each frame, dt in seconds
 *   jelly.dispose();                                  // puts the shared geometry back
 *
 * The RuneLite portal dump is one mesh: a grey stone arch plus a separate purple swirl disc
 * (no shared vertices). The disc is found from its saturated purple materials, so the OBJ
 * needs no change. Per frame, on a cloned position buffer (materials are not touched):
 *  - the disc bulges in and out along its normal with two out-of-step sines, rings ripple
 *    outward from the centre, it squashes/stretches in-plane, sways with a little shear and
 *    breathes. Every term is multiplied by (1 - r^2), so the rim stays sealed to the arch;
 *  - the arch itself gets a very slight squash and sway weighted by height^2, so the base
 *    never lifts or slides (the disc rides along with it, no gaps).
 * Flat normals are recomputed for the moved triangles only. About 1.4k vertex writes and
 * ~480 face normals per portal per frame, no allocations, no extra draw calls.
 */
import * as THREE from 'three';

export const PORTAL_JELLY_DEFAULTS = Object.freeze({
  speed: 1,            // overall time scale
  bulge: 0.2,          // disc push/pull along its normal, in disc radii
  ripple: 0.06,        // ring ripple along the normal, in disc radii
  rippleRings: 1.5,    // ripple wavelengths from centre to rim
  rippleSpeed: 4.2,    // rad/s
  tilt: 0.09,          // side-to-side jelly lobe along the normal, in disc radii
  squash: 0.16,        // in-plane squash & stretch (fraction)
  shear: 0.08,         // in-plane sway, in disc radii
  breathe: 0.04,       // slow in-plane breathing (fraction)
  frameWobble: 0.015,  // arch squash/sway at the top, fraction of height (0 = rigid)
  phase: null,         // start time offset (seconds); random when null so portals desync
  isSurface: null,     // (material, mesh) => boolean override
});

/** Saturated purple/violet/magenta faces are the swirl; the arch is grey stone. */
export function isPortalSurfaceMaterial(mat) {
  const c = mat?.color;
  if (!c) return false;
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  if (max < 0.004 || (max - min) / max < 0.35) return false;
  const hsl = {};
  c.getHSL(hsl);
  return hsl.h > 0.62 && hsl.h < 0.92 && c.b >= c.g;
}

function smallestAxis(min, max) {
  const ex = [max.x - min.x, max.y - min.y, max.z - min.z];
  return ex.indexOf(Math.min(...ex));
}

function prepMesh(mesh, opts) {
  const src = mesh.geometry;
  const pos = src?.attributes?.position;
  if (!pos || pos.itemSize !== 3) return null;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const test = opts.isSurface ?? ((mat, m) => (m.userData?.portalSurface ? true : isPortalSurfaceMaterial(mat)));
  const count = pos.count;
  const surfaceVert = new Uint8Array(count);
  const index = src.index;
  const groups = src.groups.length ? src.groups : [{ start: 0, count: index ? index.count : count, materialIndex: 0 }];
  const surfTris = [];
  for (const gr of groups) {
    const mat = Array.isArray(mesh.material) ? mats[gr.materialIndex ?? 0] : mesh.material;
    if (!test(mat, mesh)) continue;
    const end = Math.min(gr.start + gr.count, index ? index.count : count);
    for (let i = gr.start; i + 2 < end; i += 3) {
      surfTris.push(i);
      for (let k = 0; k < 3; k += 1) surfaceVert[index ? index.getX(i + k) : i + k] = 1;
    }
  }
  const geometry = src.clone();
  const base = Float32Array.from(geometry.attributes.position.array);
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox.clone();
  // Disc frame: centre, radius, normal axis (thinnest extent of the surface verts).
  const smin = new THREE.Vector3(Infinity, Infinity, Infinity);
  const smax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const v = new THREE.Vector3();
  let nSurf = 0;
  for (let i = 0; i < count; i += 1) {
    if (!surfaceVert[i]) continue;
    v.fromArray(base, i * 3);
    smin.min(v);
    smax.max(v);
    nSurf += 1;
  }
  const out = {
    mesh, source: src, geometry, base, count, surfaceVert, nSurf, bbox,
    index, triCount: index ? index.count / 3 : count / 3, surfTris: Int32Array.from(surfTris),
    nAxis: 2, uAxis: 0, vAxis: 1, centre: [0, 0, 0], radius: 1,
    // Frame wobble only makes sense when one mesh holds the whole arch (the dump).
    frame: opts.frameWobble > 0 && nSurf > 0 && nSurf < count,
  };
  if (nSurf) {
    const n = smallestAxis(smin, smax);
    const others = [0, 1, 2].filter((a) => a !== n);
    out.nAxis = n;
    out.uAxis = others[0];
    out.vAxis = others[1];
    out.centre = [(smin.x + smax.x) / 2, (smin.y + smax.y) / 2, (smin.z + smax.z) / 2];
    const ext = [smax.x - smin.x, smax.y - smin.y, smax.z - smin.z];
    out.radius = Math.max(ext[out.uAxis], ext[out.vAxis]) / 2 || 1;
    // Precompute per-vertex disc coords + falloff.
    out.du = new Float32Array(count);
    out.dv = new Float32Array(count);
    out.fall = new Float32Array(count);
    out.rr = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      if (!surfaceVert[i]) continue;
      const u = (base[i * 3 + out.uAxis] - out.centre[out.uAxis]) / out.radius;
      const w = (base[i * 3 + out.vAxis] - out.centre[out.vAxis]) / out.radius;
      const r2 = Math.min(1, u * u + w * w);
      out.du[i] = u;
      out.dv[i] = w;
      out.rr[i] = Math.sqrt(r2);
      out.fall[i] = (1 - r2) * (1 - r2 * 0.35);
    }
  }
  if (!nSurf && !out.frame) {
    geometry.dispose();
    return null;
  }
  // Inflate the cull sphere once so the wobble never pops out of the frustum.
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius *= 1.15;
  mesh.geometry = geometry;
  return out;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();
const _s = new Float64Array(3);

function faceNormals(p, tris, all) {
  const pos = p.geometry.attributes.position;
  const nor = p.geometry.attributes.normal;
  if (!nor || p.index) {
    p.geometry.computeVertexNormals();
    return;
  }
  const doTri = (i) => {
    _a.fromBufferAttribute(pos, i);
    _b.fromBufferAttribute(pos, i + 1);
    _c.fromBufferAttribute(pos, i + 2);
    _e1.subVectors(_c, _b);
    _e2.subVectors(_a, _b);
    _e1.cross(_e2).normalize();
    nor.setXYZ(i, _e1.x, _e1.y, _e1.z);
    nor.setXYZ(i + 1, _e1.x, _e1.y, _e1.z);
    nor.setXYZ(i + 2, _e1.x, _e1.y, _e1.z);
  };
  if (all) for (let i = 0; i + 2 < pos.count; i += 3) doTri(i);
  else for (let k = 0; k < tris.length; k += 1) doTri(tris[k]);
  nor.needsUpdate = true;
}

function step(p, t, o) {
  const arr = p.geometry.attributes.position.array;
  const { base, count, surfaceVert } = p;
  const R = p.radius;
  const nA = p.nAxis, uA = p.uAxis, vA = p.vAxis;
  const cu = p.centre[uA], cv = p.centre[vA];
  // Jelly terms (sines of unrelated frequencies so it never looks like a loop).
  const bulge = o.bulge * R * (Math.sin(t * 2.3) * 0.7 + Math.sin(t * 3.7 + 1.1) * 0.3);
  const tiltU = o.tilt * R * Math.sin(t * 1.9 + 0.4);
  const tiltV = o.tilt * R * 0.6 * Math.sin(t * 2.6 + 2.0);
  const sq = o.squash * (Math.sin(t * 3.1) * 0.75 + Math.sin(t * 5.3 + 0.7) * 0.25);
  const br = o.breathe * Math.sin(t * 1.15);
  const shU = o.shear * R * Math.sin(t * 2.05 + 0.9);
  const shV = o.shear * R * 0.5 * Math.sin(t * 2.9 + 2.4);
  const rip = o.ripple * R;
  const k = o.rippleRings * Math.PI * 2;
  const rt = o.rippleSpeed * t;
  // Arch wobble, anchored at the base (height^2 weight).
  const y0 = p.bbox.min.y;
  const H = Math.max(p.bbox.max.y - y0, 1e-6);
  const cx = (p.bbox.min.x + p.bbox.max.x) / 2;
  const fs = p.frame ? o.frameWobble * Math.sin(t * 3.1 + 0.25) : 0;
  const sway = p.frame ? o.frameWobble * H * 0.6 * Math.sin(t * 2.05 + 0.6) : 0;
  for (let i = 0; i < count; i += 1) {
    const j = i * 3;
    let x = base[j], y = base[j + 1], z = base[j + 2];
    if (surfaceVert[i]) {
      const f = p.fall[i];
      if (f > 0) {
        const u = p.du[i], w = p.dv[i];
        const s = _s;
        s[0] = x; s[1] = y; s[2] = z;
        s[uA] = cu + (s[uA] - cu) * (1 + (sq + br) * f) + shU * f * (1 - w * 0.5);
        s[vA] = cv + (s[vA] - cv) * (1 - sq * 0.8 * f + br * f) + shV * f;
        s[nA] += f * (bulge + tiltU * u + tiltV * w) + rip * f * Math.sin(k * p.rr[i] - rt);
        x = s[0]; y = s[1]; z = s[2];
      }
    }
    if (p.frame) {
      const h = (base[j + 1] - y0) / H;
      const h2 = h * h;
      x += (x - cx) * (-fs * 0.5) * h + sway * h2;
      y = y0 + (y - y0) * (1 + fs * h);
    }
    arr[j] = x; arr[j + 1] = y; arr[j + 2] = z;
  }
  p.geometry.attributes.position.needsUpdate = true;
  faceNormals(p, p.surfTris, p.frame);
}

export function attachPortalJelly(root, opts = {}) {
  const o = { ...PORTAL_JELLY_DEFAULTS, ...opts };
  const parts = [];
  root?.traverse((child) => {
    if (!child.isMesh || child.isSprite || !child.geometry) return;
    if (child.userData?.skipPortalJelly) return;
    const p = prepMesh(child, o);
    if (p) parts.push(p);
  });
  let t = Number.isFinite(o.phase) ? o.phase : Math.random() * 20;
  const jelly = {
    parts,
    get time() { return t; },
    update(dt) {
      if (!parts.length) return;
      const d = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
      t += d * o.speed;
      for (const p of parts) step(p, t, o);
    },
    dispose() {
      for (const p of parts) {
        if (p.mesh.geometry === p.geometry) p.mesh.geometry = p.source;
        p.geometry.dispose();
      }
      parts.length = 0;
    },
  };
  jelly.update(0);
  return jelly;
}

/** world.js tick helper: steps a portal root built by buildPortal() if it is showing. */
export function tickPortalJelly(root, dt) {
  if (!root || !root.visible) return;
  root.userData?.portalJelly?.update(dt);
}
