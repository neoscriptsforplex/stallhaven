import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Rig's animated GLB props (campfire, fireplaces, cauldron). Each GLB is a
 * drop-in for the OBJ+MTL look: same raw OSRS units, origin and pivot, so the
 * existing scale code applies unchanged. Loaded lazily in the browser; when a
 * GLB is missing the OBJ look keeps working.
 */
export const ANIM_PROP_FILES = {
  fire: 'fire_anim.glb',
  fireplace: 'fireplace_anim.glb',
  fancy_fireplace: 'fancy_fireplace_anim.glb',
  cauldron: 'cauldron_anim.glb',
  lumbridge_fountain: 'lumbridge_fountain_anim.glb',
};

/** Cap on live fire PointLights: each extra light costs every lit shader. */
export const MAX_FIRE_LIGHTS = 3;

const loaded = new Map();
let loadPromise = null;

function baseUrl() {
  try {
    return import.meta.env.BASE_URL || './';
  } catch {
    return './';
  }
}

export function getAnimProp(id) {
  return loaded.get(id) ?? null;
}

export function loadAnimProps() {
  if (loadPromise) return loadPromise;
  if (typeof window === 'undefined' || typeof fetch !== 'function') return Promise.resolve(false);
  loadPromise = Promise.resolve().then(async () => {
    const loader = new GLTFLoader();
    const base = baseUrl().replace(/\/?$/, '/');
    await Promise.all(Object.entries(ANIM_PROP_FILES).map(async ([id, file]) => {
      try {
        const gltf = await loader.loadAsync(`${base}models/anim/${file}`);
        loaded.set(id, { scene: gltf.scene, animations: gltf.animations });
      } catch (err) {
        console.warn(`Animated ${id} skipped:`, err?.message || err);
      }
    }));
    return loaded.size > 0;
  }).catch((err) => {
    console.warn('Animated props skipped:', err?.message || err);
    return false;
  });
  return loadPromise;
}

function findClip(animations, name) {
  return THREE.AnimationClip.findByName(animations, name);
}

function fireLightSpec(root) {
  let spec = null;
  root.traverse((child) => {
    if (!spec && child.userData?.fireLight) spec = child.userData.fireLight;
  });
  return spec;
}

/**
 * Attach a mixer (and fire light data) to a cloned prop. `mesh` must be a
 * clone of getAnimProp(id).scene so node names match the clip tracks.
 */
export function attachAnimProp(mesh, id) {
  const src = getAnimProp(id);
  if (!src || !mesh) return null;
  const mixer = new THREE.AnimationMixer(mesh);
  const info = { mixer, id, light: null, lightNode: null, fireLight: null, idle: null, brew: null, brewing: false };
  if (id === 'cauldron') {
    const idleClip = findClip(src.animations, 'Idle');
    const brewClip = findClip(src.animations, 'Brew');
    if (idleClip) info.idle = mixer.clipAction(idleClip);
    if (brewClip) info.brew = mixer.clipAction(brewClip);
    info.idle?.play();
  } else {
    const burn = findClip(src.animations, 'Burn') ?? findClip(src.animations, 'Flow');
    if (burn) mixer.clipAction(burn).play();
    const fl = fireLightSpec(mesh);
    if (fl) {
      info.fireLight = fl;
      info.lightNode = mesh.getObjectByName(fl.node) ?? null;
    }
  }
  mesh.userData.animProp = info;
  return info;
}

/** Visual for a placed construction piece, or null to use the OBJ look. */
export function animPieceVisual(id, scale) {
  const src = getAnimProp(id);
  if (!src) return null;
  const mesh = src.scene.clone(true);
  mesh.scale.setScalar(scale);
  mesh.updateMatrixWorld(true);
  attachAnimProp(mesh, id);
  return mesh;
}

/** Add the fire PointLight on the placed group (full metres, not under the scaled root). */
export function addFireLight(anchor, visual) {
  const info = visual?.userData?.animProp;
  if (!info?.fireLight || info.light) return null;
  const fl = info.fireLight;
  const light = new THREE.PointLight(fl.color, fl.intensity, fl.distance_m, fl.decay ?? 2);
  light.castShadow = false;
  light.name = 'fire-light';
  const pos = new THREE.Vector3();
  visual.updateMatrixWorld(true);
  if (info.lightNode) info.lightNode.getWorldPosition(pos);
  else new THREE.Box3().setFromObject(visual).getCenter(pos);
  if (visual.parent) visual.parent.worldToLocal(pos);
  light.position.copy(pos);
  anchor.add(light);
  info.light = light;
  return light;
}

export function setCauldronBrewing(info, brewing) {
  if (!info || info.brewing === brewing || !info.idle || !info.brew) return;
  info.brewing = brewing;
  if (brewing) {
    info.brew.reset().play();
    info.idle.crossFadeTo(info.brew, 0.3, false);
  } else {
    info.idle.reset().play();
    info.brew.crossFadeTo(info.idle, 0.3, false);
  }
}

export function tickAnimProp(info, dt) {
  if (!info) return;
  info.mixer.update(dt);
  if (info.light) {
    const k = info.lightNode ? info.lightNode.scale.x : 1;
    info.light.intensity = info.fireLight.intensity * Math.min(Math.max(k, 0), 2);
  }
}
