import * as THREE from 'three';

/**
 * Turn a Construction piece visual into a translucent placement ghost.
 * Keeps a single material as a single material: a material ARRAY on a GLB mesh
 * with no geometry groups draws nothing, which made bundled pieces invisible while placing.
 */
export function ghostifyPieceVisual(root, tint = null) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    child.visible = true;
    child.frustumCulled = false;
    const wasArray = Array.isArray(child.material);
    const mats = (wasArray ? child.material : [child.material]).map((mat) => {
      const next = mat?.clone?.() ?? mat;
      if (next) {
        next.transparent = true;
        next.opacity = 0.55;
        next.depthWrite = false;
        next.visible = true;
        if (tint != null && next.emissive) next.emissive = new THREE.Color(tint).multiplyScalar(0.25);
      }
      return next;
    });
    child.material = wasArray ? mats : mats[0];
    child.userData.pieceGhost = true;
  });
  return root;
}

/** Meshes in a ghost that the renderer will actually draw. */
export function visibleGhostMeshes(root) {
  const out = [];
  root.traverse((child) => {
    if (!child.isMesh || !child.visible) return;
    let up = child; let shown = true;
    while (up) { if (!up.visible) shown = false; up = up.parent; }
    if (!shown) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    if (Array.isArray(child.material) && !(child.geometry?.groups?.length)) return;
    if (mats.some((m) => m && m.visible !== false && m.opacity > 0)) out.push(child);
  });
  return out;
}
