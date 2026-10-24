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

/** Placement validity tint colours (green = valid spot, red = blocked). */
export const PLACE_TINT = { valid: 0x2fbf4a, blocked: 0xd23a2a };

/**
 * Tint whatever is being placed (Construction ghost, station, shelf, patch) green or red.
 * Swaps in tinted CLONES of each mesh's material and keeps the originals, so shared
 * materials (cached bundled models) are never touched. mode null restores the originals.
 */
export function setPlaceTint(root, mode) {
  if (!root) return;
  const next = mode === 'valid' || mode === 'blocked' ? mode : null;
  if ((root.userData.placeTint ?? null) === next) return;
  root.userData.placeTint = next;
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const ud = child.userData;
    if (ud.placeTintOrig !== undefined) {
      const clones = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of clones) if (m && m !== ud.placeTintOrig && !(Array.isArray(ud.placeTintOrig) && ud.placeTintOrig.includes(m))) m.dispose?.();
      child.material = ud.placeTintOrig;
      delete ud.placeTintOrig;
    }
    if (!next) return;
    const color = new THREE.Color(PLACE_TINT[next]);
    ud.placeTintOrig = child.material;
    const tintOne = (mat) => {
      const c = mat?.clone?.();
      if (!c) return mat;
      if (c.emissive) {
        c.emissive = color.clone().multiplyScalar(0.55);
        c.emissiveIntensity = 1;
      } else if (c.color) {
        c.color = c.color.clone().lerp(color, 0.6);
      }
      return c;
    };
    child.material = Array.isArray(child.material) ? child.material.map(tintOne) : tintOne(child.material);
  });
}
