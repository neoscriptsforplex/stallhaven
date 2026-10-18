/**
 * Outdoor pines fall after a short run of completed chops, then grow back.
 * A completed chop is one full bar that actually grants logs.
 */

/** Inclusive count of wood-granting chops rolled when a pine appears. */
export const TREE_CHOP_BUDGET = Object.freeze({ min: 3, max: 8 });
/** Seconds a stump sits before the same pine returns. */
export const TREE_RESPAWN_SEC = 30;
/** Added to TREE_RESPAWN_SEC, from -this through +this. */
export const TREE_RESPAWN_JITTER_SEC = 3;

const nodes = new Map();

export function treeSpotKey(x, z) {
  return `${Number(x).toFixed(2)},${Number(z).toFixed(2)}`;
}

export function rollTreeChopBudget(rng = Math.random) {
  const { min, max } = TREE_CHOP_BUDGET;
  const span = max - min + 1;
  return min + Math.floor(rng() * span);
}

export function rollTreeRespawnDelay(rng = Math.random) {
  const span = TREE_RESPAWN_JITTER_SEC * 2;
  return TREE_RESPAWN_SEC + (rng() * span - TREE_RESPAWN_JITTER_SEC);
}

export function resetTreeNodes() {
  nodes.clear();
}

export function ensureTreeNode(x, z, rng = Math.random) {
  const key = treeSpotKey(x, z);
  let node = nodes.get(key);
  if (!node) {
    node = {
      key,
      x: Number(x),
      z: Number(z),
      alive: true,
      chopsLeft: rollTreeChopBudget(rng),
      respawnAt: 0,
    };
    nodes.set(key, node);
  }
  return node;
}

/** Missing nodes are still standing. A stump is not a chop target. */
export function treeCanChop(x, z) {
  const node = nodes.get(treeSpotKey(x, z));
  return node ? node.alive : true;
}

export function isTreeStump(x, z) {
  const node = nodes.get(treeSpotKey(x, z));
  return Boolean(node && !node.alive);
}

/**
 * Spend one wood-granting chop. The pine falls on the chop that empties the budget.
 * Returns granted:false when the spot is already a stump, so it yields no more wood.
 */
export function completeTreeChop(x, z, now, rng = Math.random) {
  const node = ensureTreeNode(x, z, rng);
  if (!node.alive) return { granted: false, felled: false, node };
  node.chopsLeft -= 1;
  if (node.chopsLeft > 0) return { granted: true, felled: false, node };
  node.chopsLeft = 0;
  node.alive = false;
  node.respawnAt = now + rollTreeRespawnDelay(rng);
  return { granted: true, felled: true, node };
}

/** Grow back every stump whose delay has elapsed. Each return rolls a new budget. */
export function reviveDueTrees(now, rng = Math.random) {
  const revived = [];
  for (const node of nodes.values()) {
    if (node.alive || !(now >= node.respawnAt)) continue;
    node.alive = true;
    node.chopsLeft = rollTreeChopBudget(rng);
    node.respawnAt = 0;
    revived.push(node);
  }
  return revived;
}

/** Seconds the crown takes to fall and fade before the stump is shown. */
export const TREE_TOPPLE_SEC = 1;

function toppleMaterials(root) {
  const mats = [];
  root.traverse?.((child) => {
    if (!child.isMesh || !child.material) return;
    const list = Array.isArray(child.material) ? child.material : [child.material];
    const cloned = list.map((mat) => {
      if (!mat || mat.userData?.toppleClone || typeof mat.clone !== 'function') return mat;
      const next = mat.clone();
      next.userData = { ...(next.userData || {}), toppleClone: true, toppleOpacity: next.opacity ?? 1 };
      next.transparent = true;
      return next;
    });
    child.material = Array.isArray(child.material) ? cloned : cloned[0];
    for (const mat of cloned) {
      if (mat?.userData?.toppleClone) mats.push(mat);
    }
  });
  return mats;
}

function restoreTopple(visual) {
  if (!visual) return;
  if (Number.isFinite(visual.userData?.toppleBaseX) && visual.rotation) {
    visual.rotation.x = visual.userData.toppleBaseX;
  }
  visual.traverse?.((child) => {
    if (!child.isMesh || !child.material) return;
    const list = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of list) {
      if (mat?.userData?.toppleClone && Number.isFinite(mat.userData.toppleOpacity)) {
        mat.opacity = mat.userData.toppleOpacity;
      }
    }
  });
}

/** Start a one-second fall. setTreeFallen still snaps instantly for tests and respawn. */
export function startTreeTopple(tree, now) {
  if (!tree || tree.userData?.toppling) return false;
  const visual = tree.getObjectByName?.('pine-visual');
  if (!visual) return false;
  const baseX = visual.rotation?.x ?? 0;
  visual.userData = visual.userData || {};
  visual.userData.toppleBaseX = baseX;
  tree.userData.toppling = {
    startedAt: now,
    visual,
    mats: toppleMaterials(visual),
    baseX,
  };
  return true;
}

/** Advance one falling crown. Returns true on the frame it becomes a stump. */
export function tickTreeTopple(tree, now) {
  const topple = tree?.userData?.toppling;
  if (!topple) return false;
  const t = Math.min(1, Math.max(0, (now - topple.startedAt) / TREE_TOPPLE_SEC));
  if (topple.visual?.rotation) topple.visual.rotation.x = topple.baseX + (Math.PI / 2) * t;
  for (const mat of topple.mats) {
    mat.opacity = (mat.userData?.toppleOpacity ?? 1) * (1 - t);
  }
  if (t < 1) return false;
  restoreTopple(topple.visual);
  delete tree.userData.toppling;
  setTreeFallen(tree, true);
  return true;
}

/** Hide the crown and show the stump, or the reverse. Placement stays put. */
export function setTreeFallen(tree, fallen) {
  if (!tree) return;
  const visual = tree.getObjectByName('pine-visual');
  const stump = tree.getObjectByName('tree-stump');
  if (!fallen) restoreTopple(visual);
  if (visual) visual.visible = !fallen;
  if (stump) stump.visible = Boolean(fallen);
  if (!fallen && tree.userData) delete tree.userData.toppling;
  tree.traverse((child) => {
    if (child.userData?.kind !== 'tree') return;
    child.userData.depleted = Boolean(fallen);
    if (fallen) child.raycast = () => {};
    else delete child.raycast;
  });
}
