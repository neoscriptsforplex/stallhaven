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

/** Hide the crown and show the stump, or the reverse. Placement stays put. */
export function setTreeFallen(tree, fallen) {
  if (!tree) return;
  const visual = tree.getObjectByName('pine-visual');
  const stump = tree.getObjectByName('tree-stump');
  if (visual) visual.visible = !fallen;
  if (stump) stump.visible = Boolean(fallen);
  tree.traverse((child) => {
    if (child.userData?.kind !== 'tree') return;
    child.userData.depleted = Boolean(fallen);
    if (fallen) child.raycast = () => {};
    else delete child.raycast;
  });
}
