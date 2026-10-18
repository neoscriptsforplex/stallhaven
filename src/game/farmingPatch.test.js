import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import './canvas-mock.js';
import * as THREE from 'three';
import {
  FARMING_PATCH_COSTS,
  farmingPatchPoseKept,
  patchPlaceFloors,
} from './layout.js';
import { dropRecordedPatchObstacle, liveObstacles, placementBlocked } from './nav.js';
import {
  applyState,
  buyFurniture,
  createState,
  repairFarmingPatches,
  serializeState,
} from './economy.js';
import { measureVisibleBox, setBundledLook } from './models.js';
import { parseModelBuffer } from './upload.js';
import {
  buildFarmingPatch,
  farmingPatchVisible,
  placeFarmingPatchMesh,
} from './shopbuild.js';
import { PLACE_DOUBLE_CLICK_MS, nextPlaceClick } from './world.js';

const POSE = { x: -4.2, z: -8.05, rot: 0 };

function funded() {
  const state = createState();
  state.gold = 20000000;
  state.materials.iron_nails = 40;
  state.materials.oak_plank = 20;
  return state;
}

function patchBlocked(state, pose) {
  return placementBlocked(
    pose,
    'patch',
    liveObstacles(state),
    patchPlaceFloors(state.expansions ?? []),
    { checkAisle: false },
  );
}

function confirmPatch(state, pose) {
  const before = patchBlocked(state, pose);
  if (before) return { status: 'placing', reason: before };
  const gold = state.gold;
  const nails = state.materials.iron_nails;
  const planks = state.materials.oak_plank;
  if (!buyFurniture(state, 'farming_patch', pose)) return { status: 'placing', reason: 'Could not buy.' };
  const blocks = dropRecordedPatchObstacle(liveObstacles(state), state.furniture.patches, pose);
  const after = placementBlocked(
    pose,
    'patch',
    blocks,
    patchPlaceFloors(state.expansions ?? []),
    { checkAisle: false },
  );
  return {
    status: after ? 'placing' : 'placed',
    reason: after,
    count: state.furniture.patches.length,
    chargedGold: gold - state.gold,
    chargedNails: nails - state.materials.iron_nails,
    chargedPlanks: planks - state.materials.oak_plank,
  };
}

describe('farming patch confirm', () => {
  it('places one patch on confirm, charges once, and keeps it in the save', () => {
    const state = funded();
    const gold = state.gold;
    const nails = state.materials.iron_nails;
    const planks = state.materials.oak_plank;
    assert.equal(farmingPatchPoseKept(POSE, []), true);
    assert.equal(state.furniture.patches.length, 0);
    assert.equal(state.gold, gold);

    const placed = confirmPatch(state, POSE);
    assert.equal(placed.status, 'placed');
    assert.equal(placed.reason, null);
    assert.equal(placed.count, 1);
    assert.equal(state.furniture.patches.length, 1);
    assert.equal(state.boughtFurniture.farming_patch, 1);
    assert.equal(placed.chargedGold, FARMING_PATCH_COSTS[0]);
    assert.equal(placed.chargedNails, 6);
    assert.equal(placed.chargedPlanks, 2);
    assert.equal(state.gold, gold - FARMING_PATCH_COSTS[0]);

    const raw = patchBlocked(state, POSE);
    assert.equal(raw, 'That spot overlaps other furniture.');
    const ignored = dropRecordedPatchObstacle(liveObstacles(state), state.furniture.patches, POSE);
    assert.equal(placementBlocked(POSE, 'patch', ignored, patchPlaceFloors([]), { checkAisle: false }), null);

    const loaded = createState();
    assert.equal(applyState(loaded, serializeState(state)), true);
    assert.equal(loaded.furniture.patches.length, 1);
    assert.equal(loaded.furniture.patches[0].x, POSE.x);
    assert.equal(loaded.furniture.patches[0].z, POSE.z);
    assert.equal(loaded.boughtFurniture.farming_patch, 1);
    assert.equal(loaded.freeFurnitureReplace.farming_patch, 0);
    assert.equal(loaded.gold, state.gold);
  });

  it('confirms on a double-click or double-tap and only buys once', () => {
    assert.equal(PLACE_DOUBLE_CLICK_MS, 420);
    let last = 0;
    const preview = nextPlaceClick(last, 1000, true);
    assert.equal(preview.confirm, false);
    last = preview.lastAt;
    const confirm = nextPlaceClick(last, 1000 + PLACE_DOUBLE_CLICK_MS - 1, true);
    assert.equal(confirm.confirm, true);
    last = confirm.lastAt;
    const extra = nextPlaceClick(last, 1000 + PLACE_DOUBLE_CLICK_MS + 10, true);
    assert.equal(extra.confirm, false);
    assert.equal(nextPlaceClick(500, 500 + PLACE_DOUBLE_CLICK_MS, true).confirm, false);

    const state = funded();
    let stamp = 0;
    let clicks = 0;
    const onPointer = (now) => {
      const click = nextPlaceClick(stamp, now, true);
      stamp = click.lastAt;
      clicks += 1;
      if (!click.confirm) return 'preview';
      const result = confirmPatch(state, POSE);
      return result.status;
    };
    assert.equal(onPointer(2000), 'preview');
    assert.equal(onPointer(2300), 'placed');
    assert.equal(clicks, 2);
    assert.equal(state.furniture.patches.length, 1);
    assert.equal(state.boughtFurniture.farming_patch, 1);
    assert.equal(onPointer(2400), 'preview');
    assert.equal(state.furniture.patches.length, 1);
  });
});

describe('farming patch mesh', () => {
  const modelsRoot = join(dirname(fileURLToPath(import.meta.url)), '../../public/models');

  async function loadPatch() {
    const obj = readFileSync(join(modelsRoot, 'farming-patch/farming-patch.obj'));
    const mtl = readFileSync(join(modelsRoot, 'farming-patch/farming-patch.mtl'));
    return parseModelBuffer(
      obj.buffer.slice(obj.byteOffset, obj.byteOffset + obj.byteLength),
      'farming-patch.obj',
      { 'farming-patch.mtl': mtl.buffer.slice(mtl.byteOffset, mtl.byteOffset + mtl.byteLength) },
    );
  }

  it('draws the dumped plot on the confirmed spot, above the grass', async () => {
    setBundledLook('farming-patch', await loadPatch());
    try {
      const mesh = buildFarmingPatch();
      assert.notEqual(mesh.userData.farmingPatchFallback, true);
      assert.equal(farmingPatchVisible(mesh), true);
      const box = measureVisibleBox(mesh);
      const size = box.getSize(new THREE.Vector3());
      assert.ok(Math.abs(size.x - 2.88) < 0.08, `width ${size.x}`);
      assert.ok(Math.abs(size.z - 2.88) < 0.08, `depth ${size.z}`);
      assert.ok(box.min.y >= -0.001 && box.max.y > 0.04);
      placeFarmingPatchMesh(mesh, POSE, 0);
      assert.equal(mesh.position.x, POSE.x);
      assert.equal(mesh.position.y, 0);
      assert.equal(mesh.position.z, POSE.z);
    } finally {
      setBundledLook('farming-patch', null);
    }
  });

  it('uses a brown 2x2 soil plot when the model is missing or tiny', () => {
    setBundledLook('farming-patch', null);
    const missing = buildFarmingPatch();
    assert.equal(missing.userData.farmingPatchFallback, true);
    assert.equal(farmingPatchVisible(missing), true);
    let soil = null;
    missing.traverse((child) => {
      if (child.name === 'farming-patch-soil') soil = child;
    });
    assert.ok(soil);
    assert.equal(soil.material.color.getHex(), 0x6a4a28);
    const size = measureVisibleBox(missing).getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.x - 2.88) < 0.02);
    assert.ok(Math.abs(size.z - 2.88) < 0.02);

    const tiny = new THREE.Group();
    tiny.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    setBundledLook('farming-patch', tiny);
    try {
      const fallback = buildFarmingPatch();
      assert.equal(fallback.userData.farmingPatchFallback, true);
      assert.equal(farmingPatchVisible(fallback), true);
      placeFarmingPatchMesh(fallback, POSE, 0);
      assert.equal(fallback.position.x, POSE.x);
      assert.equal(fallback.position.z, POSE.z);
    } finally {
      setBundledLook('farming-patch', null);
    }
  });
});

describe('farming patch saves', () => {
  it('shows a paid lawn patch on load and returns a bad pose for a free re-place', () => {
    const hidden = createState();
    hidden.gold = 5000000;
    hidden.materials.iron_nails = 20;
    hidden.materials.oak_plank = 10;
    assert.equal(applyState(hidden, {
      gold: 4000000,
      boughtFurniture: { farming_patch: 2 },
      furniture: {
        patches: [
          { x: POSE.x, z: POSE.z, rot: 0 },
          { x: 0, z: 0, rot: 0 },
        ],
      },
    }), true);
    assert.equal(hidden.furniture.patches.length, 1);
    assert.equal(hidden.furniture.patches[0].x, POSE.x);
    assert.equal(hidden.furniture.patches[0].z, POSE.z);
    assert.equal(hidden.boughtFurniture.farming_patch, 2);
    assert.equal(hidden.freeFurnitureReplace.farming_patch, 1);
    assert.equal(hidden.gold, 4000000);

    const gold = hidden.gold;
    const nails = hidden.materials.iron_nails;
    const planks = hidden.materials.oak_plank;
    assert.equal(buyFurniture(hidden, 'farming_patch', { x: -8.4, z: -8.05, rot: 0 }), true);
    assert.equal(hidden.furniture.patches.length, 2);
    assert.equal(hidden.freeFurnitureReplace.farming_patch, 0);
    assert.equal(hidden.boughtFurniture.farming_patch, 2);
    assert.equal(hidden.gold, gold);
    assert.equal(hidden.materials.iron_nails, nails);
    assert.equal(hidden.materials.oak_plank, planks);

    const paidOnly = createState();
    paidOnly.gold = 1000;
    assert.equal(applyState(paidOnly, {
      gold: 1000,
      boughtFurniture: { farming_patch: 1 },
      furniture: { patches: [] },
    }), true);
    assert.deepEqual(paidOnly.furniture.patches, []);
    assert.equal(paidOnly.freeFurnitureReplace.farming_patch, 1);
    const repaired = repairFarmingPatches(paidOnly);
    assert.equal(repaired.credited, 1);
    assert.equal(paidOnly.gold, 1000);
  });
});
