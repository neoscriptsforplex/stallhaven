/**
 * Spin one named part of a station model around its own axle.
 *
 *   const spin = attachSpinner(root, { partName: 'saw_blade' });   // or 'spin_wheel'
 *   spin.setActive(true);    // crafting started
 *   spin.update(dt);         // every frame (dt in seconds)
 *
 * The part (an OBJ object, e.g. `o saw_blade`, which three's OBJLoader turns into a
 * child mesh with that name) is re-parented under a pivot Group placed at the axle
 * centre, so rotating the pivot turns the part around its axle without drifting.
 * Works after wrapBundledProp scaling/recentring: everything is measured in the part's
 * parent space at attach time.
 */
import * as THREE from 'three';

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

/**
 * Axle, centre (model/OSRS units, the OBJ's own coordinates) and full speed (rad/s)
 * for the parts Runecraft ships. Measured from the models:
 *  - saw_blade (sawmill.obj): disc in the XY plane, axle along Z through (75, 68, 0).
 *  - spin_wheel (wheel.obj): wheel in the YZ plane, axle along X through (0, 110.5, 25.5).
 */
export const SPIN_PRESETS = Object.freeze({
  saw_blade: { axis: 'z', pivot: [75, 68, 0], speed: -18 },
  spin_wheel: { axis: 'x', pivot: [0, 110.5, 25.5], speed: 6 },
});

function findPart(root, name) {
  let hit = null;
  root.traverse((o) => {
    if (hit || !o.name) return;
    // OBJLoader keeps the `o` name; tolerate dumps that add a prefix/suffix
    if (o.name === name || o.name.split(/[\s/]/).includes(name)) hit = o;
  });
  return hit;
}

/** Part bounds in its parent's space (part.matrix applied). */
function boundsInParent(part) {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  part.updateMatrix();
  part.updateMatrixWorld(true);
  const toParent = part.matrix.clone();
  const inv = new THREE.Matrix4().copy(part.matrixWorld).invert();
  part.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    // o -> part local -> parent
    const m = new THREE.Matrix4().multiplyMatrices(toParent, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    tmp.copy(o.geometry.boundingBox).applyMatrix4(m);
    box.union(tmp);
  });
  return box;
}

/** Thinnest bounding-box axis of a disc-like part, in the part's local frame. */
function guessAxis(part) {
  const box = new THREE.Box3();
  part.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(o.geometry.boundingBox);
  });
  const s = box.getSize(new THREE.Vector3());
  return s.x <= s.y && s.x <= s.z ? 'x' : s.y <= s.z ? 'y' : 'z';
}

/**
 * @param {THREE.Object3D} root   station model (e.g. the wrapBundledProp result)
 * @param {object} opts
 *   partName  name of the spinning child (required), e.g. 'saw_blade' | 'spin_wheel'
 *   axis      'x' | 'y' | 'z' | THREE.Vector3 in the part's local (model) frame;
 *             default: preset for partName, else the thinnest bbox axis
 *   pivot     THREE.Vector3 axle centre in the part's local (model/OSRS) frame;
 *             default: preset for partName, else the centre of the part's bounding box
 *   speed     full speed in rad/s (sign sets direction); default preset or 8
 *   easeTime  seconds to spin up / down (default 0.3)
 * @returns {{ pivot: THREE.Group, part: THREE.Object3D, setActive(on:boolean): void,
 *             update(dt:number): void, angle(): number, dispose(): void } | null}
 */
export function attachSpinner(root, opts = {}) {
  const name = opts.partName;
  const part = name ? findPart(root, name) : null;
  if (!part || !part.parent) return null;
  const preset = SPIN_PRESETS[name] ?? {};
  const parent = part.parent;
  root.updateMatrixWorld(true);

  // axle centre in the parent's space
  let centre;
  const pivotLocal = opts.pivot ?? (preset.pivot ? new THREE.Vector3().fromArray(preset.pivot) : null);
  if (pivotLocal) {
    part.updateMatrix();
    centre = pivotLocal.clone().applyMatrix4(part.matrix);
  } else {
    centre = boundsInParent(part).getCenter(new THREE.Vector3());
  }
  // axle direction in the parent's space
  const axisKey = opts.axis ?? preset.axis ?? guessAxis(part);
  const axisLocal = axisKey instanceof THREE.Vector3 ? axisKey.clone() : AXES[axisKey].clone();
  const axis = axisLocal.applyQuaternion(part.quaternion).normalize();

  const pivot = new THREE.Group();
  pivot.name = `${name}-pivot`;
  pivot.position.copy(centre);
  parent.add(pivot);
  part.position.sub(centre);
  pivot.add(part);
  pivot.updateMatrixWorld(true);

  const speed = opts.speed ?? preset.speed ?? 8;
  const easeTime = Math.max(1e-3, opts.easeTime ?? 0.3);
  let target = 0;   // 0 or 1
  let level = 0;    // 0..1 ramp
  let angle = 0;
  const q = new THREE.Quaternion();

  return {
    pivot,
    part,
    axis,
    centre,
    setActive(on) { target = on ? 1 : 0; },
    update(dt) {
      const d = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
      if (!d) return;
      const step = d / easeTime;
      level = target > level ? Math.min(target, level + step) : Math.max(target, level - step);
      if (level <= 0) return;
      const ease = level * level * (3 - 2 * level); // smoothstep: soft start and stop
      angle = (angle + speed * ease * d) % (Math.PI * 2);
      pivot.quaternion.copy(q.setFromAxisAngle(axis, angle));
    },
    angle() { return angle; },
    /** Put the part back where it was (no rotation) and drop the pivot. */
    dispose() {
      pivot.quaternion.identity();
      part.position.add(centre);
      parent.add(part);
      pivot.removeFromParent();
    },
  };
}
