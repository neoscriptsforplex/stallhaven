import * as THREE from 'three';
import { RECIPES, isCraftOreId } from './catalog.js';
import { buildWare } from './models.js';

const _box = new THREE.Box3();
const _center = new THREE.Vector3();
const _sphere = new THREE.Sphere();
const _xAxis = new THREE.Vector3(1, 0, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _pitch = new THREE.Quaternion();
const _spin = new THREE.Quaternion();

export function isRunePreview(id) {
  const recipe = RECIPES[id];
  return recipe?.category === 'rune' || recipe?.shape === 'rune';
}

/**
 * Craft-preview only. The shop mannequin keeps the ware mesh as built
 * (including wareDisplayYaw). These turns are applied on the preview object.
 *
 * Platebodies, wizard robes, mystic robe tops, and the splitbark top sit
 * sideways (sleeves up and down). A clockwise quarter-turn, as seen from the
 * +Z camera, stands them upright: collar at the top, sleeves left and right,
 * chest toward the camera. Dragon masks are tipped a quarter-turn forward so
 * the face points at that camera.
 */
const PREVIEW_EULER = {
  robe_bottom: { x: 0, y: 0, z: -Math.PI / 4 },
  platelegs: { x: Math.PI, y: 0, z: 0 },
  dhide_chaps: { x: Math.PI, y: 0, z: 0 },
  // Existing yaw brings the chest toward the camera; clockwise roll stands it up.
  platebody: { x: 0, y: Math.PI / 2, z: -Math.PI / 2 },
  robe_top: { x: Math.PI, y: 0, z: 0 },
  plateskirt: { x: Math.PI / 2, y: 0, z: 0 },
};

const CLOCKWISE_QUARTER = { x: 0, y: 0, z: -Math.PI / 2 };
const TIP_FORWARD = { x: Math.PI / 2, y: 0, z: 0 };

/** Preview-only pose for dumps whose mannequin yaw is already baked in. */
function previewOnlyEuler(id) {
  if (id === 'wizard_robe' || id === 'mystic_robe_top' || id === 'splitbark_robe_top') {
    return CLOCKWISE_QUARTER;
  }
  if (String(id).endsWith('_dragon_mask')) return TIP_FORWARD;
  return null;
}

export function craftPreviewEuler(id) {
  const keyed = previewOnlyEuler(id);
  if (keyed) return keyed;
  const shape = RECIPES[id]?.shape;
  return shape ? (PREVIEW_EULER[shape] ?? null) : null;
}

export function applyCraftPreviewEuler(object, id) {
  const euler = craftPreviewEuler(id);
  if (!object || !euler) return;
  object.rotation.set(euler.x, euler.y, euler.z);
}

/**
 * Bundled/procedural runes sit as Y-up discs with the glyph on +Y.
 * Pitch +90° around X so that face points at a +Z camera. The previous −90°
 * pitch showed the blank underside (the grey slab in the craft pane).
 */
export function poseRuneForFrontView(object, spin = 0) {
  if (!object) return;
  _pitch.setFromAxisAngle(_xAxis, Math.PI / 2);
  _spin.setFromAxisAngle(_zAxis, spin);
  object.quaternion.copy(_spin).multiply(_pitch);
  object.updateMatrixWorld(true);
}

/** Frame a craft-preview camera so the full item sits in view with margin. */
export function frameCraftPreview(object, camera, margin = 1.42, cached = null, opts = {}) {
  if (!camera) return null;
  let center = cached?.center;
  let radius = cached?.radius;
  if (!center || !Number.isFinite(radius)) {
    if (!object) return null;
    object.updateMatrixWorld(true);
    _box.setFromObject(object);
    if (_box.isEmpty()) return null;
    center = _box.getCenter(_center).clone();
    const sphere = _box.getBoundingSphere(_sphere);
    radius = Math.max(sphere.radius, 0.08);
  }
  const vFov = camera.fov * (Math.PI / 180);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(camera.aspect, 0.25));
  const limit = Math.min(vFov, hFov);
  const dist = (radius * margin) / Math.tan(limit / 2);
  if (opts.view === 'front') {
    camera.position.set(center.x, center.y, center.z + dist);
  } else {
    camera.position.set(center.x + dist * 0.42, center.y + dist * 0.02, center.z + dist * 0.88);
  }
  camera.near = Math.max(0.02, dist / 50);
  camera.far = Math.max(12, dist * 8);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  return { center, radius, dist, view: opts.view === 'front' ? 'front' : 'default' };
}

export function createCraftPreview(canvas) {
  if (!canvas) return null;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 12);
  camera.position.set(0.62, 0.48, 0.92);
  camera.lookAt(0, 0.18, 0);
  scene.add(new THREE.HemisphereLight(0xf0e2c4, 0x4a3828, 0.95));
  const key = new THREE.DirectionalLight(0xffe1b0, 0.85);
  key.position.set(0.8, 1.4, 1.1);
  scene.add(key);
  let mesh = null;
  let recipeId = null;
  let frame = null;
  let runeFront = false;
  let runeSpin = 0;

  function previewOpts() {
    return runeFront ? { view: 'front' } : {};
  }

  function fit() {
    const w = Math.max(1, canvas.clientWidth || canvas.width || 180);
    const h = Math.max(1, canvas.clientHeight || canvas.height || 180);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (frame) frameCraftPreview(mesh, camera, 1.42, frame, previewOpts());
  }

  function show(id) {
    const next = RECIPES[id] || isCraftOreId(id) ? id : null;
    if (next === recipeId) return;
    recipeId = next;
    if (mesh) {
      scene.remove(mesh);
      mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
      });
      mesh = null;
    }
    frame = null;
    runeFront = false;
    runeSpin = 0;
    if (!next) return;
    mesh = buildWare(next);
    mesh.position.set(0, 0, 0);
    runeFront = isRunePreview(next);
    if (runeFront) poseRuneForFrontView(mesh, 0);
    else applyCraftPreviewEuler(mesh, next);
    scene.add(mesh);
    frame = frameCraftPreview(mesh, camera, 1.42, null, previewOpts());
  }

  function tick(dt) {
    if (mesh) {
      if (runeFront) {
        runeSpin += dt * 0.85;
        poseRuneForFrontView(mesh, runeSpin);
      } else {
        mesh.rotation.y += dt * 0.85;
      }
    }
    fit();
    renderer.render(scene, camera);
  }

  fit();
  return { show, tick, recipeId: () => recipeId };
}
