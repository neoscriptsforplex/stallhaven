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
 * Fixed base pose shared by the craft preview and by these items on a shop
 * mannequin or table. previewBasePose is the only copy of these turns.
 * In the preview they sit on an inner group. The spin is a separate yaw on
 * the outer parent around world Y, so turning does not twist this Euler.
 * Robe tops and dragon masks already have wareDisplayYaw baked into the ware
 * mesh (PR #33). This pose is the parent turn on top of that bake — applying
 * the yaw again would double-rotate.
 *
 * Mystic robe tops are the reference: collar up, sleeves to the left and
 * right, chest toward the +Z camera. Wizard tops need the opposite roll.
 * Splitbark tops add one clockwise quarter-turn on top of the upright roll,
 * the same camera-facing roll the platebody uses.
 * Platebodies lie flat until they are pitched onto the chest and rolled
 * collar-up. Dragon masks need a half-turn so the horns are up and the face
 * points at the camera. On a display, that +Z is the furniture front.
 */
const PREVIEW_EULER = {
  robe_bottom: { x: 0, y: 0, z: -Math.PI / 4 },
  platelegs: { x: Math.PI, y: 0, z: 0 },
  dhide_chaps: { x: Math.PI, y: 0, z: 0 },
  platebody: { x: Math.PI / 2, y: 0, z: -Math.PI / 2 },
  robe_top: { x: Math.PI, y: 0, z: 0 },
  plateskirt: { x: Math.PI / 2, y: 0, z: 0 },
};

const MYSTIC_UPRIGHT = { x: 0, y: 0, z: -Math.PI / 2 };
const WIZARD_UPRIGHT = { x: 0, y: 0, z: Math.PI / 2 };
const SPLITBARK_UPRIGHT = { x: 0, y: 0, z: -Math.PI / 4 - Math.PI / 2 };
const MASK_FACE_CAMERA = { x: 0, y: 0, z: Math.PI };

/** Pose for dumps whose mannequin yaw is already baked into the ware mesh. */
function previewOnlyEuler(id) {
  if (id === 'mystic_robe_top') return MYSTIC_UPRIGHT;
  if (id === 'wizard_robe') return WIZARD_UPRIGHT;
  if (id === 'splitbark_robe_top') return SPLITBARK_UPRIGHT;
  if (String(id).endsWith('_dragon_mask')) return MASK_FACE_CAMERA;
  return null;
}

/** Platebodies, the three robe tops, and dragon masks share this pose on displays. */
export function displayUsesPreviewBasePose(id) {
  if (id === 'wizard_robe' || id === 'mystic_robe_top' || id === 'splitbark_robe_top') return true;
  if (String(id).endsWith('_dragon_mask')) return true;
  return RECIPES[id]?.shape === 'platebody';
}

/**
 * Fixed base pose: upright, front toward +Z (the preview camera, or a
 * display's local front). Null when this item has no preview turn.
 */
export function previewBasePose(id) {
  const keyed = previewOnlyEuler(id);
  if (keyed) return keyed;
  const shape = RECIPES[id]?.shape;
  return shape ? (PREVIEW_EULER[shape] ?? null) : null;
}

export function craftPreviewEuler(id) {
  return previewBasePose(id);
}

export function applyCraftPreviewEuler(object, id) {
  const euler = craftPreviewEuler(id);
  if (!object || !euler) return;
  object.rotation.order = 'XYZ';
  object.rotation.set(euler.x, euler.y, euler.z);
}

/**
 * Inner group holds the fixed base pose. The returned parent is yawed around
 * world Y while the item stays upright.
 */
export function wrapCraftPreviewSpin(ware, id) {
  const pose = new THREE.Group();
  applyCraftPreviewEuler(pose, id);
  if (ware) pose.add(ware);
  const spin = new THREE.Group();
  spin.add(pose);
  return spin;
}

/**
 * Mannequin and table mount. Same base pose as the craft preview, in the
 * caller's local space, so it follows the display when the furniture yaws.
 * Mystic and splitbark robe bottoms, and plate skirts, use that pose on a
 * mannequin only. Plate skirts are exported flat; the preview pitch is what
 * hangs them, and the euler itself is unchanged. Tables stay unposed.
 * Does not apply wareDisplayYaw; that yaw is already baked into the mesh.
 * Reseats the posed item so its bottom center stays on the slot origin.
 * Does not change scale.
 */
export function mountDisplayBasePose(ware, id, opts = {}) {
  const robeBottomOnMannequin = opts.mannequin
    && (id === 'mystic_robe_bottom' || id === 'splitbark_robe_bottom');
  const skirtOnMannequin = opts.mannequin && RECIPES[id]?.shape === 'plateskirt';
  if (!ware || (!displayUsesPreviewBasePose(id) && !robeBottomOnMannequin && !skirtOnMannequin)) return ware;
  const euler = previewBasePose(id);
  if (!euler) return ware;
  const pose = new THREE.Group();
  pose.name = 'preview-base-pose';
  applyCraftPreviewEuler(pose, id);
  pose.add(ware);
  const mount = new THREE.Group();
  mount.name = 'display-base-pose';
  mount.userData.recipeId = ware.userData?.recipeId ?? id;
  mount.add(pose);
  mount.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mount);
  if (!box.isEmpty()) {
    const center = box.getCenter(_center);
    pose.position.set(-center.x, -box.min.y, -center.z);
  }
  return mount;
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
    const ware = buildWare(next);
    ware.position.set(0, 0, 0);
    runeFront = isRunePreview(next);
    if (runeFront) {
      poseRuneForFrontView(ware, 0);
      mesh = ware;
    } else {
      mesh = wrapCraftPreviewSpin(ware, next);
    }
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
