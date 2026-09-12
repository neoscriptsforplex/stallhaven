import * as THREE from 'three';
import { RECIPES } from './catalog.js';
import { buildWare } from './models.js';

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

  function fit() {
    const w = Math.max(1, canvas.clientWidth || canvas.width || 180);
    const h = Math.max(1, canvas.clientHeight || canvas.height || 180);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
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
    if (!next) return;
    mesh = buildWare(next);
    mesh.position.set(0, 0, 0);
    scene.add(mesh);
  }

  function tick(dt) {
    if (mesh) mesh.rotation.y += dt * 0.85;
    fit();
    renderer.render(scene, camera);
  }

  fit();
  return { show, tick, recipeId: () => recipeId };
}
