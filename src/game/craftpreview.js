import * as THREE from 'three';
import { RECIPES } from './catalog.js';
import { buildWare } from './models.js';

const _box = new THREE.Box3();
const _center = new THREE.Vector3();
const _sphere = new THREE.Sphere();

/** Frame a craft-preview camera so the full item sits in view with margin. */
export function frameCraftPreview(object, camera, margin = 1.42, cached = null) {
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
  camera.position.set(center.x + dist * 0.42, center.y + dist * 0.02, center.z + dist * 0.88);
  camera.near = Math.max(0.02, dist / 50);
  camera.far = Math.max(12, dist * 8);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  return { center, radius, dist };
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

  function fit() {
    const w = Math.max(1, canvas.clientWidth || canvas.width || 180);
    const h = Math.max(1, canvas.clientHeight || canvas.height || 180);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (frame) frameCraftPreview(mesh, camera, 1.42, frame);
  }

  function show(id) {
    const next = RECIPES[id] ? id : null;
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
    if (!next) return;
    mesh = buildWare(next);
    mesh.position.set(0, 0, 0);
    scene.add(mesh);
    frame = frameCraftPreview(mesh, camera);
  }

  function tick(dt) {
    if (mesh) mesh.rotation.y += dt * 0.85;
    fit();
    renderer.render(scene, camera);
  }

  fit();
  return { show, tick, recipeId: () => recipeId };
}
