import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import './canvas-mock.js';
import * as THREE from 'three';
import { gardenTreeSpots } from './layout.js';
import { gardenObstacles } from './nav.js';
import { buildShop } from './shopbuild.js';
import {
  TREE_CHOP_BUDGET,
  TREE_RESPAWN_JITTER_SEC,
  TREE_RESPAWN_SEC,
  completeTreeChop,
  ensureTreeNode,
  isTreeStump,
  resetTreeNodes,
  reviveDueTrees,
  rollTreeChopBudget,
  rollTreeRespawnDelay,
  setTreeFallen,
  treeCanChop,
  treeSpotKey,
} from './trees.js';

afterEach(() => {
  resetTreeNodes();
});

function blockAt(blocks, x, z) {
  return blocks.find((item) => (
    Math.abs((item.minX + item.maxX) / 2 - x) < 0.05
    && Math.abs((item.minZ + item.maxZ) / 2 - z) < 0.05
  ));
}

describe('tree chop budgets', () => {
  it('rolls a completed-chop budget inside the named range', () => {
    assert.equal(TREE_CHOP_BUDGET.min, 3);
    assert.equal(TREE_CHOP_BUDGET.max, 8);
    assert.equal(rollTreeChopBudget(() => 0), TREE_CHOP_BUDGET.min);
    assert.equal(rollTreeChopBudget(() => 0.999999), TREE_CHOP_BUDGET.max);
    for (let i = 0; i < 40; i += 1) {
      const rolled = rollTreeChopBudget();
      assert.ok(rolled >= TREE_CHOP_BUDGET.min && rolled <= TREE_CHOP_BUDGET.max);
      assert.equal(rolled, Math.trunc(rolled));
    }
  });

  it('fells the pine on the chop that empties the budget and rolls a new one on respawn', () => {
    const rng = () => 0;
    const node = ensureTreeNode(1.25, -4.5, rng);
    assert.equal(node.chopsLeft, 3);
    assert.equal(treeCanChop(1.25, -4.5), true);
    assert.equal(completeTreeChop(1.25, -4.5, 100, rng).felled, false);
    assert.equal(node.chopsLeft, 2);
    assert.equal(node.alive, true);
    assert.equal(completeTreeChop(1.25, -4.5, 100, rng).felled, false);
    const last = completeTreeChop(1.25, -4.5, 100, rng);
    assert.equal(last.granted, true);
    assert.equal(last.felled, true);
    assert.equal(node.alive, false);
    assert.equal(node.chopsLeft, 0);
    assert.equal(node.respawnAt, 100 + TREE_RESPAWN_SEC - TREE_RESPAWN_JITTER_SEC);
    assert.equal(treeCanChop(1.25, -4.5), false);
    assert.equal(isTreeStump(1.25, -4.5), true);
    const extra = completeTreeChop(1.25, -4.5, 110, rng);
    assert.equal(extra.granted, false);
    assert.equal(extra.felled, false);
    assert.equal(reviveDueTrees(node.respawnAt - 0.01, rng).length, 0);
    assert.equal(node.alive, false);
    const revived = reviveDueTrees(node.respawnAt, () => 0.999999);
    assert.equal(revived.length, 1);
    assert.equal(node.alive, true);
    assert.equal(node.chopsLeft, TREE_CHOP_BUDGET.max);
    assert.equal(node.respawnAt, 0);
    assert.equal(treeCanChop(1.25, -4.5), true);
    assert.equal(isTreeStump(1.25, -4.5), false);
  });

  it('respawns after about 30s, jittered by the named constant', () => {
    assert.equal(TREE_RESPAWN_SEC, 30);
    assert.equal(TREE_RESPAWN_JITTER_SEC, 3);
    assert.equal(rollTreeRespawnDelay(() => 0), 27);
    assert.equal(rollTreeRespawnDelay(() => 0.5), 30);
    assert.equal(rollTreeRespawnDelay(() => 1), 33);
    for (let i = 0; i < 30; i += 1) {
      const delay = rollTreeRespawnDelay();
      assert.ok(delay >= TREE_RESPAWN_SEC - TREE_RESPAWN_JITTER_SEC);
      assert.ok(delay < TREE_RESPAWN_SEC + TREE_RESPAWN_JITTER_SEC);
    }
  });
});

describe('felled pine collision and look', () => {
  it('drops the trunk walk block while the pine is a stump and restores it on respawn', () => {
    const spot = gardenTreeSpots([])[0];
    assert.ok(blockAt(gardenObstacles([]), spot.x, spot.z), 'standing trunk should block');
    const node = ensureTreeNode(spot.x, spot.z, () => 0);
    while (node.alive) completeTreeChop(spot.x, spot.z, 50, () => 0);
    assert.equal(isTreeStump(spot.x, spot.z), true);
    assert.equal(blockAt(gardenObstacles([]), spot.x, spot.z), undefined);
    reviveDueTrees(node.respawnAt, () => 0);
    assert.ok(blockAt(gardenObstacles([]), spot.x, spot.z), 'grown pine should block again');
  });

  it('hides the crown, shows a stump, and keeps the planted transform', () => {
    const shop = buildShop([]).root;
    let pine = null;
    shop.traverse((child) => {
      if (!pine && child.name === 'pine' && child.userData?.gardenSide) pine = child;
    });
    assert.ok(pine, 'garden should plant a pine');
    const visual = pine.getObjectByName('pine-visual');
    const stump = pine.getObjectByName('tree-stump');
    const pick = pine.children.find((child) => child.userData?.kind === 'tree');
    assert.ok(visual?.visible, 'crown starts visible');
    assert.equal(stump?.visible, false);
    assert.equal(treeSpotKey(pick.userData.x, pick.userData.z), treeSpotKey(pine.position.x, pine.position.z));
    const placed = {
      x: pine.position.x,
      y: pine.position.y,
      z: pine.position.z,
      rot: pine.rotation.y,
      sx: pine.scale.x,
      sy: pine.scale.y,
      sz: pine.scale.z,
    };
    setTreeFallen(pine, true);
    assert.equal(visual.visible, false);
    assert.equal(stump.visible, true);
    assert.equal(pick.userData.depleted, true);
    assert.notEqual(pick.raycast, THREE.Mesh.prototype.raycast);
    assert.equal(pine.position.x, placed.x);
    assert.equal(pine.position.y, placed.y);
    assert.equal(pine.position.z, placed.z);
    assert.equal(pine.rotation.y, placed.rot);
    assert.equal(pine.scale.x, placed.sx);
    assert.equal(pine.scale.y, placed.sy);
    assert.equal(pine.scale.z, placed.sz);
    setTreeFallen(pine, false);
    assert.equal(visual.visible, true);
    assert.equal(stump.visible, false);
    assert.equal(pick.userData.depleted, false);
    assert.equal(pick.raycast, THREE.Mesh.prototype.raycast);
    assert.equal(pine.position.x, placed.x);
    assert.equal(pine.rotation.y, placed.rot);
    assert.equal(pine.scale.x, placed.sx);
  });
});
